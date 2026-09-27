-- Keep contributor stories in editorial sections and map account owners to
-- existing public authors without creating duplicate author records.
alter table public.profiles
  add column if not exists author_id uuid references public.authors(id) on delete set null;

create unique index if not exists profiles_single_account_per_author_idx
  on public.profiles (author_id)
  where author_id is not null;

create or replace function public.is_editorial_story_section(target_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.sections s
    where s.id = target_section_id
      and s.is_active
      and s.slug in ('snu', 'people', 'ideas', 'opportunities')
  )
$$;

revoke all on function public.is_editorial_story_section(uuid) from public, anon;
grant execute on function public.is_editorial_story_section(uuid) to authenticated;

drop policy if exists "Contributors can create their own drafts" on public.articles;
create policy "Contributors can create their own drafts"
  on public.articles for insert to authenticated
  with check (
    owner_profile_id = (select auth.uid())
    and status::text = 'draft'
    and author_id is null
    and is_sample = false
    and (select public.is_active_contributor())
    and (select public.is_editorial_story_section(section_id))
  );

drop policy if exists "Contributors can update their editable drafts" on public.articles;
create policy "Contributors can update their editable drafts"
  on public.articles for update to authenticated
  using (
    owner_profile_id = (select auth.uid())
    and status::text in ('draft', 'changes_requested')
    and (select public.is_active_contributor())
  )
  with check (
    owner_profile_id = (select auth.uid())
    and status::text in ('draft', 'changes_requested')
    and (select public.is_active_contributor())
    and (select public.is_editorial_story_section(section_id))
  );

create or replace function public.submit_article_for_review(target_article_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception using errcode = '42501', message = 'Sign in to submit an article';
  end if;
  if not (select public.is_active_contributor()) then
    raise exception using errcode = '42501', message = 'An active contributor profile is required';
  end if;

  select * into article_row
  from public.articles a
  where a.id = target_article_id
    and a.owner_profile_id = (select auth.uid())
  for update;
  if not found then
    raise exception using errcode = '42501', message = 'Article not found or not owned by this account';
  end if;
  if article_row.status::text not in ('draft', 'changes_requested') then
    raise exception using errcode = '42501', message = 'This article cannot be submitted in its current state';
  end if;
  if nullif(btrim(article_row.title), '') is null or nullif(btrim(article_row.dek), '') is null then
    raise exception using errcode = '22023', message = 'Add a title and dek before submitting';
  end if;
  if jsonb_typeof(article_row.body) <> 'array'
    or jsonb_array_length(article_row.body) = 0
    or not exists (
      select 1 from jsonb_array_elements(article_row.body) as paragraph(value)
      where jsonb_typeof(paragraph.value) = 'string'
        and nullif(btrim(paragraph.value #>> '{}'), '') is not null
    ) then
    raise exception using errcode = '22023', message = 'Add story text before submitting';
  end if;
  if not (select public.is_editorial_story_section(article_row.section_id)) then
    raise exception using errcode = '22023', message = 'Choose an editorial story section before submitting';
  end if;

  update public.articles
  set status = 'pending_review', submitted_at = now()
  where id = article_row.id;
end;
$$;

revoke all on function public.submit_article_for_review(uuid) from public, anon;
grant execute on function public.submit_article_for_review(uuid) to authenticated;

-- Only an active admin can set this explicit account-to-public-author mapping.
-- Existing founder/sample author rows are untouched; nothing is auto-created.
create or replace function public.set_contributor_author(
  target_profile_id uuid,
  target_author_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Active administrator access is required';
  end if;
  if target_author_id is not null and not exists (
    select 1 from public.authors au where au.id = target_author_id and au.is_public
  ) then
    raise exception using errcode = '22023', message = 'Choose an existing public author';
  end if;

  update public.profiles p
  set author_id = target_author_id
  where p.id = target_profile_id and p.status = 'active';
  if not found then
    raise exception using errcode = 'P0002', message = 'Active contributor profile not found';
  end if;

  -- Keep not-yet-published submissions aligned with the account mapping.
  update public.articles a
  set author_id = target_author_id
  where a.owner_profile_id = target_profile_id
    and a.status::text in ('draft', 'pending_review', 'changes_requested', 'rejected');
end;
$$;

revoke all on function public.set_contributor_author(uuid, uuid) from public, anon;
grant execute on function public.set_contributor_author(uuid, uuid) to authenticated;

-- Review decisions derive their public byline from the article owner's saved
-- profile mapping. A reviewer cannot substitute their own or another author.
create or replace function public.editorial_review_article(
  target_article_id uuid,
  decision text,
  target_author_id uuid default null,
  reviewer_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles%rowtype;
  mapped_author_id uuid;
  next_status text;
  clean_note text := nullif(btrim(reviewer_note), '');
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Active administrator access is required';
  end if;
  if target_author_id is not null then
    raise exception using errcode = '22023', message = 'Set the contributor author mapping separately';
  end if;
  if reviewer_note is not null and char_length(reviewer_note) > 5000 then
    raise exception using errcode = '22023', message = 'Reviewer notes must be 5,000 characters or fewer';
  end if;

  select * into article_row
  from public.articles a
  where a.id = target_article_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Article not found';
  end if;

  if decision in ('changes_requested', 'rejected', 'published') then
    if article_row.status::text <> 'pending_review' then
      raise exception using errcode = '42501', message = 'Only a pending story can receive this review decision';
    end if;
    if article_row.owner_profile_id is not null then
      select p.author_id into mapped_author_id
      from public.profiles p
      where p.id = article_row.owner_profile_id and p.status = 'active';
      if not found then
        raise exception using errcode = '22023', message = 'The contributor account is not active';
      end if;
    end if;
    next_status := decision;

    if decision in ('changes_requested', 'rejected') and clean_note is null then
      raise exception using errcode = '22023', message = 'Add a reviewer note for this decision';
    end if;
    if decision = 'published' then
      if mapped_author_id is null or not exists (
        select 1 from public.authors au where au.id = mapped_author_id and au.is_public
      ) then
        raise exception using errcode = '22023', message = 'Associate this contributor with a public author before publishing';
      end if;
      if nullif(btrim(article_row.title), '') is null
        or nullif(btrim(article_row.dek), '') is null
        or jsonb_typeof(article_row.body) <> 'array'
        or jsonb_array_length(article_row.body) = 0
        or not exists (
          select 1 from jsonb_array_elements(article_row.body) as paragraph(value)
          where jsonb_typeof(paragraph.value) = 'string'
            and nullif(btrim(paragraph.value #>> '{}'), '') is not null
        ) then
        raise exception using errcode = '22023', message = 'The story needs a title, dek, and body before publishing';
      end if;
      if not (select public.is_editorial_story_section(article_row.section_id)) then
        raise exception using errcode = '22023', message = 'The story must use an editorial story section';
      end if;
    end if;

    update public.articles
    set status = next_status::public.content_status,
        author_id = mapped_author_id,
        published_at = case when decision = 'published' then coalesce(published_at, now()) else published_at end,
        reviewed_at = now()
    where id = article_row.id;
  elsif decision = 'archived' then
    if article_row.status::text <> 'published' then
      raise exception using errcode = '42501', message = 'Only a published story can be archived';
    end if;
    next_status := 'archived';
    update public.articles set status = 'archived', reviewed_at = now() where id = article_row.id;
  else
    raise exception using errcode = '22023', message = 'Unsupported editorial decision';
  end if;

  insert into public.article_review_notes (article_id, reviewer_profile_id, decision, note)
  values (article_row.id, (select auth.uid()), next_status, clean_note);
end;
$$;

revoke all on function public.editorial_review_article(uuid, text, uuid, text) from public, anon;
grant execute on function public.editorial_review_article(uuid, text, uuid, text) to authenticated;

drop policy if exists "Contributors can read notes on requested changes" on public.article_review_notes;
create policy "Contributors can read their private article history"
  on public.article_review_notes for select to authenticated
  using (
    exists (
      select 1 from public.articles a
      where a.id = article_review_notes.article_id
        and a.owner_profile_id = (select auth.uid())
    )
    and (select public.is_active_contributor())
  );

-- Hard delete is available only through this admin-checked function. Review
-- notes cascade with their article; direct table deletes remain revoked.
create or replace function public.delete_editorial_article(target_article_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  deleted_id uuid;
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Active administrator access is required';
  end if;
  delete from public.articles a where a.id = target_article_id returning a.id into deleted_id;
  if deleted_id is null then
    raise exception using errcode = 'P0002', message = 'Article not found';
  end if;
end;
$$;

revoke all on function public.delete_editorial_article(uuid) from public, anon;
grant execute on function public.delete_editorial_article(uuid) to authenticated;

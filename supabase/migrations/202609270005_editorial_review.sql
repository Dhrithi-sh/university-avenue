-- Editorial decisions and internal notes stay separate from public article data.
create table if not exists public.article_review_notes (
  id uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles(id) on delete cascade,
  reviewer_profile_id uuid not null references public.profiles(id) on delete restrict,
  decision text not null check (decision in ('changes_requested', 'rejected', 'published', 'archived')),
  note text check (note is null or char_length(note) <= 5000),
  created_at timestamptz not null default now()
);

create index if not exists article_review_notes_article_time_idx
  on public.article_review_notes (article_id, created_at desc);

alter table public.article_review_notes enable row level security;
revoke all on public.article_review_notes from anon, authenticated;
grant select on public.article_review_notes to authenticated;

drop policy if exists "Admins can read editorial review notes" on public.article_review_notes;
create policy "Admins can read editorial review notes"
  on public.article_review_notes for select to authenticated
  using ((select public.is_admin()));

drop policy if exists "Contributors can read notes on requested changes" on public.article_review_notes;
create policy "Contributors can read notes on requested changes"
  on public.article_review_notes for select to authenticated
  using (
    exists (
      select 1
      from public.articles a
      where a.id = article_review_notes.article_id
        and a.owner_profile_id = (select auth.uid())
        and a.status::text = 'changes_requested'
    )
    and (select public.is_active_contributor())
  );

drop policy if exists "Admins can read all articles" on public.articles;
create policy "Admins can read all articles"
  on public.articles for select to authenticated
  using ((select public.is_admin()));

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
  next_status text;
  resolved_author_id uuid;
  clean_note text := nullif(btrim(reviewer_note), '');
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Active administrator access is required';
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
    next_status := decision;
    resolved_author_id := coalesce(target_author_id, article_row.author_id);

    if target_author_id is not null and not exists (
      select 1 from public.authors au
      where au.id = target_author_id and au.is_public
    ) then
      raise exception using errcode = '22023', message = 'Choose an existing public author';
    end if;

    if decision = 'changes_requested' and clean_note is null then
      raise exception using errcode = '22023', message = 'Add a reviewer note when requesting changes';
    end if;

    if decision = 'published' then
      if resolved_author_id is null or not exists (
        select 1 from public.authors au
        where au.id = resolved_author_id and au.is_public
      ) then
        raise exception using errcode = '22023', message = 'Assign a public byline before publishing';
      end if;
      if nullif(btrim(article_row.title), '') is null
        or nullif(btrim(article_row.dek), '') is null
        or jsonb_typeof(article_row.body) <> 'array'
        or jsonb_array_length(article_row.body) = 0
        or not exists (
          select 1
          from jsonb_array_elements(article_row.body) as paragraph(value)
          where jsonb_typeof(paragraph.value) = 'string'
            and nullif(btrim(paragraph.value #>> '{}'), '') is not null
        ) then
        raise exception using errcode = '22023', message = 'The story needs a title, dek, and body before publishing';
      end if;
      if not exists (select 1 from public.sections s where s.id = article_row.section_id and s.is_active) then
        raise exception using errcode = '22023', message = 'The story must use an active section';
      end if;
    end if;

    update public.articles
    set status = next_status::public.content_status,
        author_id = resolved_author_id,
        published_at = case when decision = 'published' then coalesce(published_at, now()) else published_at end,
        reviewed_at = now()
    where id = article_row.id;
  elsif decision = 'archived' then
    if article_row.status::text <> 'published' then
      raise exception using errcode = '42501', message = 'Only a published story can be archived';
    end if;
    next_status := 'archived';
    update public.articles
    set status = 'archived', reviewed_at = now()
    where id = article_row.id;
  else
    raise exception using errcode = '22023', message = 'Unsupported editorial decision';
  end if;

  insert into public.article_review_notes (article_id, reviewer_profile_id, decision, note)
  values (article_row.id, (select auth.uid()), next_status, clean_note);
end;
$$;

revoke all on function public.editorial_review_article(uuid, text, uuid, text) from public, anon;
grant execute on function public.editorial_review_article(uuid, text, uuid, text) to authenticated;

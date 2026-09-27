-- Contributor-owned writing, with workflow transitions enforced by RLS and RPC.

-- Authenticated ownership is separate from the public byline. Drafts do not
-- create or expose public author records; Phase 4 assigns author_id on publish.
alter table public.articles alter column author_id drop not null;
alter table public.articles
  add column if not exists owner_profile_id uuid references public.profiles(id) on delete restrict,
  add column if not exists submitted_at timestamptz,
  add column if not exists reviewed_at timestamptz;

alter table public.articles
  drop constraint if exists articles_published_requires_author;
alter table public.articles
  add constraint articles_published_requires_author
  check (status::text <> 'published' or author_id is not null);

alter table public.articles
  drop constraint if exists articles_editorial_fields_within_limits;
alter table public.articles
  add constraint articles_editorial_fields_within_limits
  check (
    char_length(title) <= 240
    and char_length(dek) <= 500
    and (image_alt is null or char_length(image_alt) <= 300)
    and octet_length(body::text) <= 200000
  );

create index if not exists articles_owner_workflow_idx
  on public.articles (owner_profile_id, status, updated_at desc)
  where owner_profile_id is not null;

create or replace function public.is_active_contributor()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.status = 'active'
      and p.role in ('contributor', 'admin')
  )
$$;

revoke all on function public.is_active_contributor() from public, anon;
grant execute on function public.is_active_contributor() to authenticated;

-- Keep the public published-only policy from Phase 1, and add private owner
-- visibility for the contributor's own submissions.
drop policy if exists "Contributors can read their own articles" on public.articles;
create policy "Contributors can read their own articles"
  on public.articles for select to authenticated
  using (
    owner_profile_id = (select auth.uid())
    and (select public.is_active_contributor())
  );

drop policy if exists "Contributors can create their own drafts" on public.articles;
create policy "Contributors can create their own drafts"
  on public.articles for insert to authenticated
  with check (
    owner_profile_id = (select auth.uid())
    and status::text = 'draft'
    and author_id is null
    and is_sample = false
    and (select public.is_active_contributor())
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
  );

-- Column privileges make status, owner, byline, published fields, and sample
-- flags immutable to contributors. New drafts use the database's safe defaults.
revoke insert, update, delete on public.articles from anon, authenticated;
grant select on public.articles to anon, authenticated;
grant insert (slug, title, dek, body, section_id, owner_profile_id, image_url, image_alt)
  on public.articles to authenticated;
grant update (title, dek, body, section_id, image_url, image_alt)
  on public.articles to authenticated;

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

  if nullif(btrim(article_row.title), '') is null
    or nullif(btrim(article_row.dek), '') is null then
    raise exception using errcode = '22023', message = 'Add a title and dek before submitting';
  end if;

  if jsonb_typeof(article_row.body) <> 'array'
    or jsonb_array_length(article_row.body) = 0
    or not exists (
      select 1
      from jsonb_array_elements(article_row.body) as paragraph(value)
      where jsonb_typeof(paragraph.value) = 'string'
        and nullif(btrim(paragraph.value #>> '{}'), '') is not null
    ) then
    raise exception using errcode = '22023', message = 'Add story text before submitting';
  end if;

  if not exists (
    select 1 from public.sections s
    where s.id = article_row.section_id and s.is_active
  ) then
    raise exception using errcode = '22023', message = 'Choose an active section before submitting';
  end if;

  update public.articles
  set status = 'pending_review', submitted_at = now()
  where id = article_row.id;
end;
$$;

revoke all on function public.submit_article_for_review(uuid) from public, anon;
grant execute on function public.submit_article_for_review(uuid) to authenticated;

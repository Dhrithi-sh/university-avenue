-- Make the contributor profile the single public identity and article byline.
-- Legacy authorship is migrated only through an existing, unique profile mapping.

alter table public.profiles
  add column if not exists role_title text not null default '',
  add column if not exists seo_description text,
  add column if not exists is_public boolean not null default true;

do $$
declare
  unmapped_articles integer;
  mismatched_articles integer;
begin
  select count(*) into unmapped_articles
  from public.articles a
  where a.owner_profile_id is null
    and (a.author_id is null or not exists (
      select 1 from public.profiles p where p.author_id = a.author_id
    ));
  if unmapped_articles > 0 then
    raise exception 'Profile authorship migration stopped: % article(s) have no unambiguous contributor profile mapping. Resolve these article/author identities before retrying.', unmapped_articles;
  end if;

  select count(*) into mismatched_articles
  from public.articles a
  join public.profiles p on p.id = a.owner_profile_id
  where a.author_id is not null and p.author_id is distinct from a.author_id;
  if mismatched_articles > 0 then
    raise exception 'Profile authorship migration stopped: % article(s) have an owner whose profile conflicts with the existing author byline. Resolve these identities before retrying.', mismatched_articles;
  end if;
end;
$$;

-- The previous migration already established a unique profiles.author_id link.
-- Use only that verified link to backfill legacy articles; never infer by name.
update public.articles a
set owner_profile_id = p.id
from public.profiles p
where a.owner_profile_id is null
  and p.author_id = a.author_id;

do $$
declare
  unresolved_articles integer;
begin
  select count(*) into unresolved_articles
  from public.articles a
  where a.owner_profile_id is null;
  if unresolved_articles > 0 then
    raise exception 'Profile authorship migration stopped: % article(s) remain without an owner profile.', unresolved_articles;
  end if;
end;
$$;

alter table public.articles alter column owner_profile_id set not null;

-- Carry Dhrithi's already-public founder bio, title and photo into her existing
-- mapped profile. Contact email is deliberately not copied from authors.
update public.profiles p
set role_title = coalesce(nullif(p.role_title, ''), a.role_title),
    bio = case when p.bio = '' then a.bio else p.bio end,
    avatar_url = coalesce(p.avatar_url, a.photo_url),
    seo_description = coalesce(p.seo_description, a.seo_description),
    is_public = a.is_public
from public.authors a
where p.author_id = a.id;

do $$
begin
  if exists (
    select 1 from public.profiles p
    where p.author_id = (select a.id from public.authors a where a.slug = 'dhrithi-shashibushan')
      and p.slug <> 'dhrithi-shashibushan'
      and exists (select 1 from public.profiles collision where collision.slug = 'dhrithi-shashibushan' and collision.id <> p.id)
  ) then
    raise exception 'Profile authorship migration stopped: the established Dhrithi profile slug conflicts with another profile.';
  end if;
end;
$$;

update public.profiles p
set slug = 'dhrithi-shashibushan'
from public.authors a
where p.author_id = a.id
  and a.slug = 'dhrithi-shashibushan';

-- Signup now creates only the normal contributor profile. The profile itself
-- is their public identity; there is no secondary author provisioning step.
create or replace function public.create_profile_for_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_name text;
begin
  profile_name := coalesce(
    nullif(left(btrim(new.raw_user_meta_data ->> 'display_name'), 120), ''),
    nullif(left(split_part(coalesce(new.email, ''), '@', 1), 120), ''),
    'Contributor'
  );
  insert into public.profiles (id, email, display_name, slug, role, status)
  values (new.id, new.email, profile_name, public.profile_slug(profile_name, new.id), 'contributor', 'active')
  on conflict (id) do update set email = excluded.email, updated_at = now();
  return new;
end;
$$;
revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;

-- Preserve ownership as an immutable, database-checked contributor identity.
create or replace function public.enforce_article_profile_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null then
    if tg_op = 'INSERT' and new.owner_profile_id is distinct from (select auth.uid()) then
      raise exception using errcode = '42501', message = 'An article must belong to the signed-in contributor profile';
    end if;
    if tg_op = 'UPDATE'
      and new.owner_profile_id is distinct from old.owner_profile_id
      and not (select public.is_admin()) then
      raise exception using errcode = '42501', message = 'Article authorship cannot be changed';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.enforce_article_profile_owner() from public, anon, authenticated;
drop trigger if exists articles_assign_author_from_owner on public.articles;
drop trigger if exists articles_enforce_profile_owner on public.articles;
create trigger articles_enforce_profile_owner
  before insert or update of owner_profile_id on public.articles
  for each row execute function public.enforce_article_profile_owner();

drop function if exists public.assign_article_author_from_owner();
drop function if exists public.ensure_public_author_for_profile(uuid, text, boolean);
drop function if exists public.set_contributor_author(uuid, uuid);

alter table public.articles drop constraint if exists articles_published_requires_author;
alter table public.articles
  add constraint articles_published_requires_profile
  check (status::text <> 'published' or owner_profile_id is not null);

drop policy if exists "Contributors can create their own drafts" on public.articles;
create policy "Contributors can create their own drafts"
  on public.articles for insert to authenticated
  with check (
    owner_profile_id = (select auth.uid())
    and status::text = 'draft'
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

create or replace function public.is_public_profile(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = target_profile_id and p.is_public and p.status = 'active'
  )
$$;
revoke all on function public.is_public_profile(uuid) from public, anon;
grant execute on function public.is_public_profile(uuid) to anon, authenticated;

drop policy if exists "Public can read published articles" on public.articles;
create policy "Public can read published articles"
  on public.articles for select to anon, authenticated
  using (
    status::text = 'published'
    and (select public.is_public_profile(owner_profile_id))
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
  if (select auth.uid()) is null or not (select public.is_active_contributor()) then
    raise exception using errcode = '42501', message = 'An active contributor profile is required';
  end if;
  select * into article_row from public.articles a
  where a.id = target_article_id and a.owner_profile_id = (select auth.uid()) for update;
  if not found then
    raise exception using errcode = '42501', message = 'Article not found or not owned by this account';
  end if;
  if article_row.status::text not in ('draft', 'changes_requested') then
    raise exception using errcode = '42501', message = 'This article cannot be submitted in its current state';
  end if;
  if nullif(btrim(article_row.title), '') is null or nullif(btrim(article_row.dek), '') is null then
    raise exception using errcode = '22023', message = 'Add a title and dek before submitting';
  end if;
  if jsonb_typeof(article_row.body) <> 'array' or jsonb_array_length(article_row.body) = 0
    or not exists (
      select 1 from jsonb_array_elements(article_row.body) as paragraph(value)
      where jsonb_typeof(paragraph.value) = 'string' and nullif(btrim(paragraph.value #>> '{}'), '') is not null
    ) then
    raise exception using errcode = '22023', message = 'Add story text before submitting';
  end if;
  if not (select public.is_editorial_story_section(article_row.section_id)) then
    raise exception using errcode = '22023', message = 'Choose an editorial story section before submitting';
  end if;
  update public.articles set status = 'pending_review', submitted_at = now()
  where id = article_row.id;
end;
$$;
revoke all on function public.submit_article_for_review(uuid) from public, anon;
grant execute on function public.submit_article_for_review(uuid) to authenticated;

drop function if exists public.editorial_review_article(uuid, text, uuid, text);
create or replace function public.editorial_review_article(
  target_article_id uuid,
  decision text,
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
  clean_note text := nullif(btrim(reviewer_note), '');
begin
  if (select auth.uid()) is null or not (select public.is_admin()) then
    raise exception using errcode = '42501', message = 'Active administrator access is required';
  end if;
  if reviewer_note is not null and char_length(reviewer_note) > 5000 then
    raise exception using errcode = '22023', message = 'Reviewer notes must be 5,000 characters or fewer';
  end if;
  select * into article_row from public.articles a where a.id = target_article_id for update;
  if not found then raise exception using errcode = 'P0002', message = 'Article not found'; end if;

  if decision in ('changes_requested', 'rejected', 'published') then
    if article_row.status::text <> 'pending_review' then
      raise exception using errcode = '42501', message = 'Only a pending story can receive this review decision';
    end if;
    if article_row.owner_profile_id is null or not exists (
      select 1 from public.profiles p where p.id = article_row.owner_profile_id and p.status = 'active'
    ) then
      raise exception using errcode = '22023', message = 'The story has no active contributor profile';
    end if;
    if decision in ('changes_requested', 'rejected') and clean_note is null then
      raise exception using errcode = '22023', message = 'Add a reviewer note for this decision';
    end if;
    if decision = 'published' then
      if nullif(btrim(article_row.title), '') is null or nullif(btrim(article_row.dek), '') is null
        or jsonb_typeof(article_row.body) <> 'array' or jsonb_array_length(article_row.body) = 0
        or not exists (
          select 1 from jsonb_array_elements(article_row.body) as paragraph(value)
          where jsonb_typeof(paragraph.value) = 'string' and nullif(btrim(paragraph.value #>> '{}'), '') is not null
        ) then
        raise exception using errcode = '22023', message = 'The story needs a title, dek, and body before publishing';
      end if;
      if not (select public.is_editorial_story_section(article_row.section_id)) then
        raise exception using errcode = '22023', message = 'The story must use an editorial story section';
      end if;
    end if;
    next_status := decision;
    update public.articles
      set status = next_status::public.content_status,
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
revoke all on function public.editorial_review_article(uuid, text, text) from public, anon;
grant execute on function public.editorial_review_article(uuid, text, text) to authenticated;

-- A tightly scoped security-definer view makes public profile data available
-- without exposing private email, role, or account status columns.
create or replace view public.public_profiles
with (security_barrier = true)
as
select id, slug, display_name, role_title, bio, avatar_url, seo_description
from public.profiles
where is_public and status = 'active';
revoke all on public.public_profiles from public;
grant select on public.public_profiles to anon, authenticated;

-- Remove mapping column/foreign key only after the data has been migrated and
-- all runtime functions, policies, and application reads no longer depend on it.
drop index if exists public.profiles_single_account_per_author_idx;
alter table public.profiles drop constraint if exists profiles_author_id_fkey;
alter table public.profiles drop column if exists author_id;
alter table public.articles drop constraint if exists articles_author_id_fkey;
alter table public.articles drop column if exists author_id;

-- RESTRICT is intentional: any uninspected FK/view dependency aborts instead
-- of cascading data or schema changes.
drop table public.authors restrict;

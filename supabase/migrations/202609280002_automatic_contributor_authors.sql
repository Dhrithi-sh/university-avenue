-- Make the profile-to-author relationship automatic and account-bound.
-- Exact email matches reuse a public author when that identity is unambiguous.
-- The one known legacy founder mapping is reused only when the canonical
-- author slug and unique exact full-name profile identify one account.

create or replace function public.ensure_public_author_for_profile(
  target_profile_id uuid,
  target_email text default null,
  allow_known_legacy_match boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_row public.profiles%rowtype;
  matching_author_ids uuid[];
  author_to_use uuid;
  base_slug text;
  generated_slug text;
  name_collision boolean;
  exact_profile_count integer;
begin
  select * into profile_row
  from public.profiles p
  where p.id = target_profile_id
  for update;
  if not found then
    return null;
  end if;

  -- The request identifies Dhrithi's existing public profile as intentional.
  -- Reuse it for a unique exact legacy profile only, including correcting a
  -- prior manual mapping, but never steal an author already linked elsewhere.
  if allow_known_legacy_match
    and lower(btrim(profile_row.display_name)) = 'dhrithi shashibushan' then
    select array_agg(au.id) into matching_author_ids
    from public.authors au
    where au.is_public
      and au.slug = 'dhrithi-shashibushan'
      and lower(btrim(au.name)) = 'dhrithi shashibushan'
      and not exists (
        select 1 from public.profiles p
        where p.author_id = au.id and p.id <> target_profile_id
      );
    select count(*) into exact_profile_count
    from public.profiles p
    where lower(btrim(p.display_name)) = 'dhrithi shashibushan';
    if coalesce(cardinality(matching_author_ids), 0) = 1 and exact_profile_count = 1 then
      author_to_use := matching_author_ids[1];
      if profile_row.author_id is distinct from author_to_use then
        update public.profiles p set author_id = author_to_use
        where p.id = target_profile_id;
      end if;
      return author_to_use;
    end if;
  end if;

  if profile_row.author_id is not null then
    return profile_row.author_id;
  end if;

  if nullif(btrim(coalesce(target_email, profile_row.email)), '') is not null then
    select array_agg(au.id) into matching_author_ids
    from public.authors au
    where au.is_public
      and au.email is not null
      and lower(btrim(au.email)) = lower(btrim(coalesce(target_email, profile_row.email)))
      and not exists (
        select 1 from public.profiles p
        where p.author_id = au.id and p.id <> target_profile_id
      );
    if coalesce(cardinality(matching_author_ids), 0) = 1 then
      author_to_use := matching_author_ids[1];
    end if;
  end if;

  if author_to_use is not null then
    update public.profiles p set author_id = author_to_use
    where p.id = target_profile_id and p.author_id is null;
    return author_to_use;
  end if;

  select exists (
    select 1 from public.authors au
    where lower(btrim(au.name)) = lower(btrim(profile_row.display_name))
  ) into name_collision;

  -- Do not guess when a legacy profile's name collides with an existing
  -- public author. Leave it for verified identity resolution instead.
  if allow_known_legacy_match and name_collision then
    return null;
  end if;

  base_slug := trim(both '-' from regexp_replace(lower(btrim(profile_row.display_name)), '[^a-z0-9]+', '-', 'g'));
  base_slug := left(coalesce(nullif(base_slug, ''), 'contributor'), 60);
  generated_slug := base_slug || '-' || replace(profile_row.id::text, '-', '');

  insert into public.authors (slug, name, is_public)
  values (generated_slug, profile_row.display_name, true)
  on conflict (slug) do nothing;

  select au.id into author_to_use
  from public.authors au
  where au.slug = generated_slug;
  if author_to_use is null then
    raise exception using errcode = '23505', message = 'Could not provision a unique public author profile';
  end if;

  update public.profiles p set author_id = author_to_use
  where p.id = target_profile_id and p.author_id is null;
  if not found then
    select p.author_id into author_to_use from public.profiles p where p.id = target_profile_id;
  end if;
  return author_to_use;
end;
$$;

revoke all on function public.ensure_public_author_for_profile(uuid, text, boolean) from public, anon, authenticated;

-- Existing unambiguous email/known founder relationships are reused. Other
-- unmapped profiles receive one stable, profile-specific public author. A
-- same-name collision without safe identity data is left unresolved rather
-- than silently linking two people or duplicating a known author.
do $$
declare
  profile_row record;
  unresolved_profiles integer;
begin
  for profile_row in select p.id, p.email from public.profiles p where p.author_id is null loop
    perform public.ensure_public_author_for_profile(profile_row.id, profile_row.email, true);
  end loop;
  select count(*) into unresolved_profiles from public.profiles p where p.author_id is null;
  if unresolved_profiles > 0 then
    raise notice '% existing account profile(s) remain unmapped because identity could not be matched safely; resolve using verified Auth account IDs.', unresolved_profiles;
  end if;
end;
$$;

-- New Auth users get a public profile as part of the same signup transaction.
-- Public contact email is intentionally not copied from private Auth data.
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

  perform public.ensure_public_author_for_profile(new.id, new.email, false);
  return new;
end;
$$;

revoke all on function public.create_profile_for_auth_user() from public, anon, authenticated;

-- Stamp every contributor draft with its profile's author in the database.
create or replace function public.assign_article_author_from_owner()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_author_id uuid;
begin
  if new.owner_profile_id is null then
    return new;
  end if;
  select p.author_id into profile_author_id
  from public.profiles p
  where p.id = new.owner_profile_id
    and p.status = 'active'
    and p.role in ('contributor', 'admin');
  if profile_author_id is null then
    raise exception using errcode = '22023', message = 'Your public author profile is not ready yet';
  end if;
  new.author_id := profile_author_id;
  return new;
end;
$$;

revoke all on function public.assign_article_author_from_owner() from public, anon, authenticated;
drop trigger if exists articles_assign_author_from_owner on public.articles;
create trigger articles_assign_author_from_owner
  before insert on public.articles
  for each row execute function public.assign_article_author_from_owner();

drop policy if exists "Contributors can create their own drafts" on public.articles;
create policy "Contributors can create their own drafts"
  on public.articles for insert to authenticated
  with check (
    owner_profile_id = (select auth.uid())
    and status::text = 'draft'
    and author_id is not distinct from (
      select p.author_id from public.profiles p where p.id = (select auth.uid())
    )
    and is_sample = false
    and (select public.is_active_contributor())
    and (select public.is_editorial_story_section(section_id))
  );

-- Repair only non-sample, non-published contributor work. Published and
-- archived bylines and all seeded/sample articles remain untouched.
update public.articles a
set author_id = p.author_id
from public.profiles p
where a.owner_profile_id = p.id
  and p.author_id is not null
  and a.is_sample = false
  and a.status::text in ('draft', 'pending_review', 'changes_requested', 'rejected');

create or replace function public.submit_article_for_review(target_article_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  article_row public.articles%rowtype;
  profile_author_id uuid;
begin
  if (select auth.uid()) is null or not (select public.is_active_contributor()) then
    raise exception using errcode = '42501', message = 'An active contributor profile is required';
  end if;
  select p.author_id into profile_author_id from public.profiles p where p.id = (select auth.uid());
  if profile_author_id is null then
    raise exception using errcode = '22023', message = 'Your public author profile is not ready yet';
  end if;
  select * into article_row from public.articles a
  where a.id = target_article_id and a.owner_profile_id = (select auth.uid())
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
  if jsonb_typeof(article_row.body) <> 'array' or jsonb_array_length(article_row.body) = 0
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
  set status = 'pending_review', submitted_at = now(), author_id = profile_author_id
  where id = article_row.id;
end;
$$;

revoke all on function public.submit_article_for_review(uuid) from public, anon;
grant execute on function public.submit_article_for_review(uuid) to authenticated;

-- Remove per-article author selection from the review RPC. The only source of
-- contributor authorship is now the article owner's profile relationship.
drop function if exists public.editorial_review_article(uuid, text, uuid, text);
create function public.editorial_review_article(
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
  contributor_author_id uuid;
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
  if not found then
    raise exception using errcode = 'P0002', message = 'Article not found';
  end if;

  if decision in ('changes_requested', 'rejected', 'published') then
    if article_row.status::text <> 'pending_review' then
      raise exception using errcode = '42501', message = 'Only a pending story can receive this review decision';
    end if;
    if article_row.owner_profile_id is null then
      raise exception using errcode = '22023', message = 'The story has no contributor account';
    end if;
    select p.author_id into contributor_author_id
    from public.profiles p where p.id = article_row.owner_profile_id;
    if decision in ('changes_requested', 'rejected') and clean_note is null then
      raise exception using errcode = '22023', message = 'Add a reviewer note for this decision';
    end if;
    next_status := decision;
    if decision = 'published' then
      if contributor_author_id is null or not exists (
        select 1 from public.authors au where au.id = contributor_author_id and au.is_public
      ) then
        raise exception using errcode = '22023', message = 'The contributor public author profile is not available';
      end if;
      if nullif(btrim(article_row.title), '') is null or nullif(btrim(article_row.dek), '') is null
        or jsonb_typeof(article_row.body) <> 'array' or jsonb_array_length(article_row.body) = 0
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
        author_id = coalesce(contributor_author_id, article_row.author_id),
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

-- Automatic identity is the only contributor-to-author mapping mechanism.
drop function if exists public.set_contributor_author(uuid, uuid);

-- The earlier automatic-author mapping attached the seeded Dhrithi profile to
-- a different contributor account. Resolve only the exact seeded five-story
-- set and the unique exact-name Dhrithi profile; abort on any drift.
do $$
declare
  dhrithi_profile_id uuid;
  displaced_profile_id uuid;
  dhrithi_profile_count integer;
  seeded_story_count integer;
  restored_slug text;
  founder_bio text;
  founder_title text;
  founder_seo text;
  founder_avatar text;
begin
  select count(*) into dhrithi_profile_count
  from public.profiles p
  where lower(btrim(p.display_name)) = 'dhrithi shashibushan';
  if dhrithi_profile_count <> 1 then
    raise exception 'Founder profile repair stopped: expected one exact Dhrithi profile, found %.', dhrithi_profile_count;
  end if;

  select p.id into dhrithi_profile_id
  from public.profiles p
  where lower(btrim(p.display_name)) = 'dhrithi shashibushan';

  select p.id, p.bio, p.role_title, p.seo_description, p.avatar_url
  into displaced_profile_id, founder_bio, founder_title, founder_seo, founder_avatar
  from public.profiles p
  where p.slug = 'dhrithi-shashibushan';
  if displaced_profile_id is null or displaced_profile_id = dhrithi_profile_id
    or founder_title <> 'Founder · University Avenue'
    or founder_bio not like 'Hello, I’m Dhrithi.%' then
    raise exception 'Founder profile repair stopped: the canonical slug does not contain the expected displaced founder profile data.';
  end if;

  if exists (
    select 1 from public.profiles p
    where p.id = dhrithi_profile_id
      and (p.bio <> '' or p.role_title <> '' or p.avatar_url is not null or p.seo_description is not null)
  ) then
    raise exception 'Founder profile repair stopped: the exact-name Dhrithi profile already contains public profile data.';
  end if;

  select count(*) into seeded_story_count
  from public.articles a
  where a.slug in (
    'campus-after-the-monsoon',
    'the-library-is-a-living-room',
    'who-gets-to-feel-at-home',
    'a-stage-under-the-stars',
    'small-grants-big-questions'
  )
    and a.is_sample
    and a.owner_profile_id = displaced_profile_id;
  if seeded_story_count <> 5 then
    raise exception 'Founder profile repair stopped: expected all five identified sample stories on the displaced profile, found %.', seeded_story_count;
  end if;

  restored_slug := public.profile_slug('Sravan Varma', displaced_profile_id);
  if exists (select 1 from public.profiles p where p.slug = restored_slug and p.id <> displaced_profile_id) then
    raise exception 'Founder profile repair stopped: Sravan’s deterministic profile slug is already in use.';
  end if;

  update public.profiles
  set slug = restored_slug,
      role_title = '',
      bio = '',
      avatar_url = null,
      seo_description = null,
      updated_at = now()
  where id = displaced_profile_id;

  update public.profiles
  set slug = 'dhrithi-shashibushan',
      role_title = founder_title,
      bio = founder_bio,
      avatar_url = founder_avatar,
      seo_description = founder_seo,
      is_public = true,
      updated_at = now()
  where id = dhrithi_profile_id;

  update public.articles
  set owner_profile_id = dhrithi_profile_id
  where slug in (
    'campus-after-the-monsoon',
    'the-library-is-a-living-room',
    'who-gets-to-feel-at-home',
    'a-stage-under-the-stars',
    'small-grants-big-questions'
  )
    and is_sample
    and owner_profile_id = displaced_profile_id;
end;
$$;

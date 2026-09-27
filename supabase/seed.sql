-- Repeatable V1.2.0 placeholder dataset. All seeded editorial records are marked as samples.
insert into public.sections (slug, name, sort_order, is_active) values
  ('snu', 'SNU', 1, true),
  ('people', 'People', 2, true),
  ('ideas', 'Ideas', 3, true),
  ('events', 'Events', 4, true),
  ('opportunities', 'Opportunities', 5, true)
on conflict (slug) do update set name = excluded.name, sort_order = excluded.sort_order, is_active = excluded.is_active, updated_at = now();

insert into public.articles (
  slug, title, dek, excerpt, body, published_at, read_time_minutes, image_url, image_alt,
  section_id, owner_profile_id, is_featured, sort_order, is_sample, status, seo_title, seo_description
)
select source.slug, source.title, source.dek, null, source.body, source.published_at::timestamptz,
  source.read_time_minutes, source.image_url, source.image_alt, section.id, profile.id,
  source.is_featured, source.sort_order, true, 'published', null, null
from (values
  (
    'campus-after-the-monsoon',
    'After the monsoon, a campus learns to find its way',
    'On the paths, puddles and small routines that shape life at Shiv Nadar University.',
    jsonb_build_array(
      $$At first light, the campus is still damp. Rain beads on the gulmohar leaves and gathers in the shallow dips along the road between the hostels and the academic blocks. The day begins in small negotiations with the weather: a longer route, a borrowed umbrella, a pause beneath the awning.$$,
      $$These ordinary passages rarely make it into the official account of a university. Yet they are where a campus becomes legible to the people who live in it. Students learn which path dries first, where the morning light falls, and how much time to leave when the sky turns dark.$$,
      $$University Avenue is an independent journal of those details and the larger questions they lead us to ask. This is a dispatch from a place still becoming itself.$$
    ),
    '2026-09-18 12:00:00+00', 6,
    'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1800&q=85',
    'After the monsoon, a campus learns to find its way', 'snu', true, 1
  ),
  (
    'the-library-is-a-living-room',
    'The library is becoming the campus living room',
    'A closer look at the shared spaces students make their own between classes.',
    jsonb_build_array(
      $$By late afternoon, the quietest floor is not always the quietest place. Chairs turn toward one another; a table becomes a meeting room, then a dining table, then a place to sit without needing a reason.$$,
      $$The university library was designed for books and study. Students have added something less easy to draw on a plan: a sense of belonging that comes from being around other people, even when nobody is speaking.$$
    ),
    '2026-09-12 12:00:00+00', 5,
    'https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=85',
    'The library is becoming the campus living room', 'people', false, 2
  ),
  (
    'who-gets-to-feel-at-home',
    'Who gets to feel at home on a new campus?',
    'Belonging is built in the everyday gestures that make a place feel shared.',
    jsonb_build_array(
      $$A campus can be open on a map and still take time to feel welcoming. The feeling arrives through people: the classmate who saves a seat, the senior who explains where to go, the familiar face at the café.$$,
      $$Thinking about belonging means paying attention to who finds those doors easily and who has to search for them. It asks us to treat welcome as a practice, not a slogan.$$
    ),
    '2026-09-04 12:00:00+00', 8,
    'https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=85',
    'Who gets to feel at home on a new campus?', 'ideas', false, 3
  ),
  (
    'a-stage-under-the-stars',
    'A stage under the stars, made by students',
    'The people behind the late-night rehearsals and the campus performances they bring to life.',
    jsonb_build_array(
      $$The first audience arrives while the light is still blue. Behind the stage, someone checks a cable, another smooths a costume, and the cast runs a final line under their breath.$$,
      $$Campus performances are temporary by nature, but the work that brings them together leaves a longer trace: new collaborations, new confidence and a reason to gather.$$
    ),
    '2026-08-27 12:00:00+00', 4,
    'https://images.unsplash.com/photo-1506157786151-b8491531f063?auto=format&fit=crop&w=1200&q=85',
    'A stage under the stars, made by students', 'events', false, 4
  ),
  (
    'small-grants-big-questions',
    'Small grants, big questions: funding student research',
    'What early-career researchers need to turn a good question into a project.',
    jsonb_build_array(
      $$For students with a research question, the first obstacle is often not an answer but a budget. A modest grant can pay for materials, local travel or the time needed to learn a new method.$$,
      $$Faculty mentors say the strongest proposals begin small and clear. The point is not to solve everything at once; it is to make the next step possible.$$
    ),
    '2026-08-19 12:00:00+00', 7,
    'https://images.unsplash.com/photo-1532094349884-543bc11b234d?auto=format&fit=crop&w=1200&q=85',
    'Small grants, big questions: funding student research', 'opportunities', false, 5
  )
) as source(slug, title, dek, body, published_at, read_time_minutes, image_url, image_alt, section_slug, is_featured, sort_order)
join public.sections section on section.slug = source.section_slug
cross join public.profiles profile
where profile.slug = 'dhrithi-shashibushan'
on conflict (slug) do update set
  title = excluded.title,
  dek = excluded.dek,
  excerpt = excluded.excerpt,
  body = excluded.body,
  published_at = excluded.published_at,
  read_time_minutes = excluded.read_time_minutes,
  image_url = excluded.image_url,
  image_alt = excluded.image_alt,
  section_id = excluded.section_id,
  owner_profile_id = excluded.owner_profile_id,
  is_featured = excluded.is_featured,
  sort_order = excluded.sort_order,
  is_sample = excluded.is_sample,
  status = excluded.status,
  updated_at = now();

insert into public.events (slug, title, event_date, start_time, location, description, category, is_sample, status) values
  ('open-mic-on-the-lawn', 'Open mic on the lawn', '2026-09-26', '18:30', 'Student Centre', null, 'Community', true, 'published'),
  ('future-of-public-health', 'The future of public health', '2026-09-29', '17:00', 'Auditorium 2', null, 'Talk', true, 'published'),
  ('autumn-makers-market', 'Autumn makers market', '2026-10-03', '11:00', 'Central courtyard', null, 'Campus life', true, 'published')
on conflict (slug) do update set title = excluded.title, event_date = excluded.event_date, start_time = excluded.start_time, location = excluded.location, description = excluded.description, category = excluded.category, is_sample = excluded.is_sample, status = excluded.status, updated_at = now();

insert into public.opportunities (
  slug, title, category, organization, description, deadline, eligibility, location, mode,
  application_url, action_label, is_sample, status
) values
  ('undergraduate-research-fellowship', 'Undergraduate Research Fellowship', 'Research', 'Sample department', 'A semester-long opportunity to work with a faculty mentor on an independent research question.', '2026-10-04', 'Sample eligibility: undergraduate students', 'Sample: on campus', null, 'mailto:hello@universityavenue.in?subject=Sample%20opportunity%20details', 'Ask about this sample', true, 'published'),
  ('campus-voices-student-writing-call', 'Campus Voices: student writing call', 'Writing', 'Sample · University Avenue', 'Pitch a reported story, photo essay or personal reflection about life at SNU.', '2026-10-10', 'Sample eligibility: SNU students', 'Sample: online submissions', null, 'mailto:hello@universityavenue.in?subject=Sample%20opportunity%20details', 'Ask about this sample', true, 'published'),
  ('centre-for-public-policy-internship', 'Centre for Public Policy internship', 'Internship', 'Sample · Centre for Public Policy', 'Join a student team supporting research, communications and public events.', '2026-10-15', 'Sample eligibility: second- to fourth-year students', 'Sample: on campus', null, 'mailto:hello@universityavenue.in?subject=Sample%20opportunity%20details', 'Ask about this sample', true, 'published')
on conflict (slug) do update set title = excluded.title, category = excluded.category, organization = excluded.organization, description = excluded.description, deadline = excluded.deadline, eligibility = excluded.eligibility, location = excluded.location, mode = excluded.mode, application_url = excluded.application_url, action_label = excluded.action_label, is_sample = excluded.is_sample, status = excluded.status, updated_at = now();

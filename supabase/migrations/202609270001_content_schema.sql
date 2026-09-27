do $$ begin
  create type public.content_status as enum ('draft', 'published', 'archived');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.sections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null unique,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.authors (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  role_title text not null default '',
  bio text not null default '',
  photo_url text,
  email text,
  seo_description text,
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.articles (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  dek text not null,
  excerpt text,
  body jsonb not null default '[]'::jsonb check (jsonb_typeof(body) = 'array'),
  published_at timestamptz,
  read_time_minutes integer check (read_time_minutes is null or read_time_minutes > 0),
  image_url text,
  image_alt text,
  section_id uuid not null references public.sections(id) on delete restrict,
  author_id uuid not null references public.authors(id) on delete restrict,
  is_featured boolean not null default false,
  sort_order integer not null default 0,
  is_sample boolean not null default false,
  status public.content_status not null default 'draft',
  seo_title text,
  seo_description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  event_date date not null,
  start_time time,
  end_time time,
  location text,
  description text,
  category text not null,
  image_url text,
  event_url text,
  organizer text,
  is_sample boolean not null default false,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  category text not null,
  organization text not null,
  description text not null,
  opens_at timestamptz,
  deadline date,
  eligibility text,
  location text,
  mode text,
  application_url text,
  action_label text not null default 'Learn more',
  image_url text,
  is_sample boolean not null default false,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists articles_published_order_idx on public.articles (status, is_featured desc, sort_order, published_at desc);
create index if not exists articles_section_idx on public.articles (section_id, status, sort_order);
create index if not exists articles_author_idx on public.articles (author_id, status, sort_order);
create index if not exists events_published_date_idx on public.events (status, event_date, start_time);
create index if not exists opportunities_published_deadline_idx on public.opportunities (status, deadline);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sections_set_updated_at on public.sections;
create trigger sections_set_updated_at before update on public.sections for each row execute function public.set_updated_at();
drop trigger if exists authors_set_updated_at on public.authors;
create trigger authors_set_updated_at before update on public.authors for each row execute function public.set_updated_at();
drop trigger if exists articles_set_updated_at on public.articles;
create trigger articles_set_updated_at before update on public.articles for each row execute function public.set_updated_at();
drop trigger if exists events_set_updated_at on public.events;
create trigger events_set_updated_at before update on public.events for each row execute function public.set_updated_at();
drop trigger if exists opportunities_set_updated_at on public.opportunities;
create trigger opportunities_set_updated_at before update on public.opportunities for each row execute function public.set_updated_at();

alter table public.sections enable row level security;
alter table public.authors enable row level security;
alter table public.articles enable row level security;
alter table public.events enable row level security;
alter table public.opportunities enable row level security;

revoke all on public.sections, public.authors, public.articles, public.events, public.opportunities from anon, authenticated;
grant usage on schema public to anon, authenticated;
grant select on public.sections, public.authors, public.articles, public.events, public.opportunities to anon, authenticated;

drop policy if exists "Public can read active sections" on public.sections;
create policy "Public can read active sections" on public.sections for select to anon, authenticated using (is_active);

drop policy if exists "Public can read public authors" on public.authors;
create policy "Public can read public authors" on public.authors for select to anon, authenticated using (is_public);

drop policy if exists "Public can read published articles" on public.articles;
create policy "Public can read published articles" on public.articles for select to anon, authenticated using (status = 'published');

drop policy if exists "Public can read published events" on public.events;
create policy "Public can read published events" on public.events for select to anon, authenticated using (status = 'published');

drop policy if exists "Public can read published opportunities" on public.opportunities;
create policy "Public can read published opportunities" on public.opportunities for select to anon, authenticated using (status = 'published');

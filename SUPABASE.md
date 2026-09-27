# University Avenue content database

The public site reads articles, authors, section records, events, and opportunities from Supabase Postgres through the server-only data layer in `app/lib/data.ts`. The Supabase client lives in `app/lib/supabase/server.ts`. It uses only the project's public publishable key; it never uses a service-role key. Row Level Security is the final check on every public query.

## Create and configure the Supabase project

1. Create a Supabase project and keep its database password in a password manager.
2. Copy `.env.example` to `.env.local`.
3. In the Supabase dashboard, copy the project URL and publishable API key into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. These are public client credentials; do not put a service-role/secret key in this application.
4. Restart `npm run dev` after changing environment variables. `.env.local` is ignored by Git.

Next.js loads `.env.local` when its dev/build/start process launches. If either variable is missing, development pages show a configuration error; production logs the missing configuration and retains the empty-state fallback (`Nothing here yet.`). The app does not fall back to a hardcoded production content file.

## Tables and relationships

- `sections`: route slug, existing section/category name, display order and active state. Article categories continue to use the existing values (`SNU`, `People`, `Ideas`, `Events`, `Opportunities`); the Editorial navigation still points to `/ideas`.
- `authors`: author/person profile, role, bio, optional photo/contact, public visibility and SEO description. Dhrithi’s existing founder profile lives here. The current People route is a story section, not a directory of profiles, so no separate `people` table is added.
- `articles`: existing slug, title, dek, JSON paragraph body, publication timestamp, reading time, image URL/alt, SEO fields, status, sample/featured flags and sort order. `author_id` and `section_id` are foreign keys to `authors` and `sections`.
- `events`: date and optional start/end time, location, description, category, organizer/link/image, status and sample flag.
- `opportunities`: category/type, organization, description, open/deadline dates, eligibility, location/mode, application URL/label, status and sample flag.

The opportunity page's **Stories** column queries `articles` in the Opportunities section; it is not a second article system. Existing Unsplash image URLs are stored in `image_url` and remain external URLs. The schema can also store a Supabase Storage URL later; no images are copied or uploaded by this migration.

## Apply the migration and seed

The checked-in schema migration is `supabase/migrations/202609270001_content_schema.sql`; the repeatable placeholder data is `supabase/seed.sql`. `supabase/config.toml` points the CLI to that seed file.

Install the Supabase CLI in this project if it is not already installed (`npm install --save-dev supabase`), then authenticate and link the new project:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push --include-seed
```

`db push --include-seed` applies pending migrations and then the configured seed file to the linked project. Run this only against a new/empty content schema. The seed is repeatable, but its upserts intentionally restore the original sample values for those slugs; do not rerun it after replacing the samples unless restoring them is intended. Supabase documents the migration and seed workflow in its [database migration guide](https://supabase.com/docs/guides/deployment/database-migrations).

For a local Supabase stack, install Docker Desktop (or another Docker-compatible runtime), then run:

```powershell
npx supabase start
npx supabase db reset
```

The reset recreates the local database, applies migrations, then seeds the data. Use the local API URL and publishable key printed by `npx supabase start` in `.env.local` when developing locally. See the [Supabase CLI setup guide](https://supabase.com/docs/guides/local-development/cli/getting-started) and [seed guide](https://supabase.com/docs/guides/local-development/seeding-your-database).

## Placeholder migration and later editing

The seed preserves all five current article slugs, titles, deks, bodies, images, dates and authors. It also inserts the current sections, Dhrithi’s founder profile, three existing events and the three existing sample opportunities (Research Fellowship, Campus Voices, Internship). All five articles, all events and all opportunities are flagged `is_sample = true`; sample opportunity values remain visibly identified on the site.

To replace placeholder journalism later, update the corresponding database row while keeping its slug if its public URL should stay the same. Set `is_sample = false` when the replacement is real. Set `status = 'draft'` to remove an item from public queries, `published` to show it, or `archived` to keep it out of public reads. The public RLS policies permit reads only for published content (and public authors/active sections); they grant no public write access. Admin/authenticated write policies are deliberately deferred to the CMS phase.

Schema and application row types are kept together in `app/lib/database.types.ts`; the UI-facing types and row-to-presentation mapping live in `app/lib/types.ts` and `app/lib/data.ts`. When the schema changes, update the migration and these types together (or regenerate types with the Supabase CLI and review the resulting diff).

## Current limits

- Configure the project URL and publishable key in `.env.local`, and restart Next.js before expecting the site to query its migrated stories.
- The frontend is database-only for published articles, events, opportunities and author/profile content. With unavailable database content it renders empty states; article URLs return not-found until their published rows exist.
- There is no CMS, login, admin role, upload workflow, Storage bucket, or public write endpoint yet. Existing remote images continue to work as before.
- Public pages use server-side reads and React request memoization. The sitemap revalidates hourly. Content pages remain dynamic so a publish/unpublish change is reflected without rebuilding the site.

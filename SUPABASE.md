# University Avenue content database

The public site reads articles, authors, section records, events, and opportunities from Supabase Postgres through the server-only data layer in `app/lib/data.ts`. The Supabase SSR clients in `app/lib/supabase/` use the project's public publishable key and cookie-backed sessions; this app never uses a service-role key. Row Level Security is the final check on every database query.

## Create and configure the Supabase project

1. Create a Supabase project and keep its database password in a password manager.
2. Copy `.env.example` to `.env.local`.
3. In the Supabase dashboard, copy the project URL and publishable API key into `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` in `.env.local`. These are public client credentials; do not put a service-role/secret key in this application.
4. Restart `npm run dev` after changing environment variables. `.env.local` is ignored by Git.

Next.js loads `.env.local` when its dev/build/start process launches. If either variable is missing, development pages show a configuration error; production logs the missing configuration and retains the empty-state fallback (`Nothing here yet.`). The app does not fall back to a hardcoded production content file.

## Tables and relationships

- `sections`: route slug, existing section/category name, display order and active state. Article categories continue to use the existing values (`SNU`, `People`, `Ideas`, `Events`, `Opportunities`); the Editorial navigation still points to `/ideas`.
- `authors`: author/person profile, role, bio, optional photo/contact, public visibility and SEO description. Dhrithi’s existing founder profile lives here. The current People route is a story section, not a directory of profiles, so no separate `people` table is added.
- `profiles`: private account profile linked 1:1 to `auth.users`. It stores the signed-in user's display name and account role/status. This is distinct from `authors`, which remains the public editorial byline/profile model; Dhrithi’s existing author page and content are not replaced.
- `articles`: existing slug, title, dek, JSON paragraph body, publication timestamp, reading time, image URL/alt, SEO fields, status, sample/featured flags and sort order. `author_id` and `section_id` are foreign keys to `authors` and `sections`.
- `events`: date and optional start/end time, location, description, category, organizer/link/image, status and sample flag.
- `opportunities`: category/type, organization, description, open/deadline dates, eligibility, location/mode, application URL/label, status and sample flag.

The opportunity page's **Stories** column queries `articles` in the Opportunities section; it is not a second article system. Existing Unsplash image URLs are stored in `image_url` and remain external URLs. The schema can also store a Supabase Storage URL later; no images are copied or uploaded by this migration.

## Apply the migration and seed

The content migration is `supabase/migrations/202609270001_content_schema.sql`; the authentication/profile migration is `supabase/migrations/202609270002_auth_profiles.sql`; the contributor-status migration is `supabase/migrations/202609270003_contributor_statuses.sql`; the contributor-writing migration is `supabase/migrations/202609270004_contributor_writing.sql`; the editorial review migration is `supabase/migrations/202609270005_editorial_review.sql`; the Phase 4 refinement migration is `supabase/migrations/202609280001_phase4_editorial_refinements.sql`; the repeatable placeholder data is `supabase/seed.sql`. `supabase/config.toml` points the CLI to that seed file.

Install the Supabase CLI in this project if it is not already installed (`npm install --save-dev supabase`), then authenticate and link the new project:

```powershell
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

For the already seeded Phase 1 project, `db push` applies the new migration without rerunning the sample seed. For a new, empty project only, use `npx supabase db push --include-seed` to apply migrations and seed the sample content. The seed's upserts restore sample values for its slugs, so do not rerun it after replacing those samples unless restoring them is intended. Supabase documents the migration and seed workflow in its [database migration guide](https://supabase.com/docs/guides/deployment/database-migrations).

For a local Supabase stack, install Docker Desktop (or another Docker-compatible runtime), then run:

```powershell
npx supabase start
npx supabase db reset
```

The reset recreates the local database, applies migrations, then seeds the data. Use the local API URL and publishable key printed by `npx supabase start` in `.env.local` when developing locally. See the [Supabase CLI setup guide](https://supabase.com/docs/guides/local-development/cli/getting-started) and [seed guide](https://supabase.com/docs/guides/local-development/seeding-your-database).

## Authentication and roles

Authentication uses Supabase Auth email/password methods and `@supabase/ssr` cookie sessions. The routes are `/signup`, `/login`, `/forgot-password`, `/reset-password`, and `/auth/callback`. Signup creates a contributor profile automatically in a database trigger; passwords remain entirely managed by Supabase Auth. `/contribute` requires an active signed-in profile. `/admin` and `/admin/articles/[id]` require the database-backed `admin` role. The primary navigation links signed-out visitors to `/login?next=%2Fcontribute`, gives signed-in users a My Stories link, and only shows the Admin link to active admin profiles. The server pages and database functions remain the authorization boundary.

In Supabase **Authentication → URL Configuration**, set the production Site URL and add the site's `/auth/callback` URLs (including their `next` query parameter) to the redirect allow-list. For local work, allow `http://localhost:3000/auth/callback**`; add the equivalent production callback pattern for `https://universityavenue.in`. Email confirmation must be enabled for the verification flow. Supabase's default email sender is rate-limited; configure SMTP for dependable production verification and reset emails. See the [Supabase password auth guide](https://supabase.com/docs/guides/auth/passwords) and [redirect URL guide](https://supabase.com/docs/guides/auth/redirect-urls).

The profiles migration backfills existing Auth users as contributors and creates future profiles with `role = 'contributor'`. The existing public author record for Dhrithi is not an Auth identity, and this repository does not identify which Auth user is hers. Do not infer it from the author slug or invent an email. To promote the founder, first verify the correct account under **Authentication → Users**, then run this in the Supabase SQL Editor with that exact user's ID and email:

```sql
update public.profiles
set role = 'admin', status = 'active'
where id = '<verified-auth-user-uuid>'::uuid
  and email = '<verified-account-email>';
```

Confirm that exactly one row changed. The profile role/status are not user-updatable columns. The `set_profile_access` database function permits only an active admin to change those fields; RLS separately limits profile reads/updates. Public/anonymous users have no profile access. No service-role key is required for the app.

## Placeholder migration and later editing

The seed preserves all five current article slugs, titles, deks, bodies, images, dates and authors. It also inserts the current sections, Dhrithi’s founder profile, three existing events and the three existing sample opportunities (Research Fellowship, Campus Voices, Internship). All five articles, all events and all opportunities are flagged `is_sample = true`; sample opportunity values remain visibly identified on the site.

To replace placeholder journalism later, update the corresponding database row while keeping its slug if its public URL should stay the same. Set `is_sample = false` when the replacement is real. The public RLS policies permit reads only for published content (and public authors/active sections); they grant no public write access.

Schema and application row types are kept together in `app/lib/database.types.ts`; the UI-facing types and row-to-presentation mapping live in `app/lib/types.ts` and `app/lib/data.ts`. When the schema changes, update the migration and these types together (or regenerate types with the Supabase CLI and review the resulting diff).

## Contributor writing workflow

Apply `202609270003_contributor_statuses.sql`, `202609270004_contributor_writing.sql`, `202609270005_editorial_review.sql`, and `202609280001_phase4_editorial_refinements.sql` to the already-linked Supabase project with `npx supabase db push`. Do not use `--include-seed` for the existing project; the migrations preserve all current article, event, opportunity, and author rows.

Contributor identity is stored in `profiles` and linked to an article through nullable `articles.owner_profile_id`. The existing `articles.author_id` remains the public byline relationship to `authors`. New drafts have no contributor-controlled public byline; an admin maps the profile to one existing public author record, and the database derives the story byline from that relationship during review. A database check prevents publishing without a byline. Existing founder and sample article author links are unchanged.

The workflow statuses are `draft`, `pending_review`, `changes_requested`, `published`, `rejected`, and `archived`. Contributors can read their own rows, create their own default-draft rows, and edit their own drafts or changes-requested rows. Column grants prevent them changing ownership, byline, sample flags, publication metadata, or status. Contributor story submissions are restricted in the UI, RLS, and database functions to active `snu`, `people`, `ideas`, and `opportunities` sections. Opportunities-section articles are editorial stories about opportunities; structured `opportunities` rows remain admin-managed. `submit_article_for_review(uuid)` verifies the active profile, ownership, editable state, title, dek, non-empty body, and allowed editorial section, then changes status to `pending_review` and stamps `submitted_at`. Public article reads still require `published`; pending and draft stories remain outside public pages, routes, and sitemap.

The writing interface is `/contribute`, `/contribute/new`, and `/contribute/[id]/edit`. Article images currently use optional HTTP(S) URLs; uploads and Storage are deferred.

## Editorial review workflow

The admin dashboard lives at `/admin`; individual submissions are reviewed at `/admin/articles/[id]`. `article_review_notes` is a private decision history with no anonymous read policy. Contributors can read the complete review history for their own articles, and admins can read history for all articles. Notes are never queried by the public data layer.

The `editorial_review_article` database function is the only editorial transition endpoint. It requires an active admin and enforces `pending_review → changes_requested | rejected | published` and `published → archived`. Requesting changes and rejecting require a note. Publishing requires an existing public `authors` byline and complete story fields. A profile's nullable `author_id` links its Auth/profile identity to an existing public author record. An admin sets this relationship once from a review page; no author record is auto-created, and the approving admin is never used as the story author. Publication derives the byline from the contributor profile mapping. This mapping does not infer that an Auth user is Dhrithi; explicitly link the verified account to Dhrithi's existing public author record if appropriate. Active admins can permanently delete published, rejected, or archived submissions from their review pages via `delete_editorial_article(uuid)`; associated review notes cascade with the article. Direct article deletion remains unavailable to contributors.

## Current limits

- Configure the project URL and publishable key in `.env.local`, and restart Next.js before expecting the site to query its migrated stories.
- The frontend is database-only for published articles, events, opportunities and author/profile content. With unavailable database content it renders empty states; article URLs return not-found until their published rows exist.
- There is no image upload workflow or Storage bucket yet. Existing remote images continue to work as before.
- Admin byline mapping, expanded private review history, section restrictions, and hard deletion require migration `202609280001_phase4_editorial_refinements.sql`. Apply it before using those features. Map each contributor profile to an existing public author from a review page before publishing.
- Public pages use server-side reads and React request memoization. The sitemap revalidates hourly. Content pages remain dynamic so a publish/unpublish change is reflected without rebuilding the site.

-- Allow active administrators to manage structured event/opportunity listings.
-- Existing public published-only SELECT policies remain in place.
-- This migration adds permissions and policies only; it does not modify rows,
-- columns, tables, seed data, or existing public read policies.

grant insert, update, delete on public.events, public.opportunities to authenticated;

drop policy if exists "Active admins manage events" on public.events;
create policy "Active admins manage events"
  on public.events
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

drop policy if exists "Active admins manage opportunities" on public.opportunities;
create policy "Active admins manage opportunities"
  on public.opportunities
  for all
  to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

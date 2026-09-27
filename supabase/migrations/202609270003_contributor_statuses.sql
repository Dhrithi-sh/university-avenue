-- Keep enum additions in their own migration transaction so Postgres commits
-- the new enum values before later policies and functions use them.
alter type public.content_status add value if not exists 'pending_review';
alter type public.content_status add value if not exists 'changes_requested';
alter type public.content_status add value if not exists 'rejected';

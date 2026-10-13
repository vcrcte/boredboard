-- Universal share links (docs/designs/first-20-users.md, tasks U1/U6).
--
-- 1. share_events: anonymous, aggregate events from /s/<post id> pages
--    (page view, a tap on a service button, a tap on "Partage le tien").
--    No visitor identifier is stored. Rows are written by the server with the
--    service role only: RLS is on and there is no policy, so the anon and
--    authenticated roles can neither read nor write them.
--    Retention: 90 days (run the delete below periodically, or schedule it).
-- 2. profiles.referred_by_post: the shared post a new account came from.

create table if not exists public.share_events (
  id bigint generated always as identity primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  event text not null check (event in ('view', 'tap', 'join_tap')),
  service text check (service in ('spotify', 'apple', 'deezer', 'soundcloud', 'youtube')),
  match_method text check (match_method in ('source', 'isrc', 'text+duration', 'search-fallback', 'pending')),
  created_at timestamptz not null default now()
);

create index if not exists share_events_post_idx on public.share_events (post_id, created_at);

alter table public.share_events enable row level security;

alter table public.profiles
  add column if not exists referred_by_post uuid references public.posts(id) on delete set null;

-- Retention (90 days):
-- delete from public.share_events where created_at < now() - interval '90 days';

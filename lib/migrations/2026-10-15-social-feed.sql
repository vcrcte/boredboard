-- Social feed (2026-10-15): what friends read and follow becomes visible.
--
-- Until now follows and books were readable only by their owner ("for all
-- using auth.uid() = …"), so nobody could see who follows them, follower
-- counts were wrong for everyone else, and a friend's reading list could never
-- appear in the feed. Writes stay owner-only: these are SELECT-only policies,
-- for signed-in users (not the anonymous key).

drop policy if exists "Abonnements visibles par les membres" on public.follows;
create policy "Abonnements visibles par les membres" on public.follows
  for select to authenticated using (true);

drop policy if exists "Livres visibles par les membres" on public.books;
create policy "Livres visibles par les membres" on public.books
  for select to authenticated using (true);

-- Feed and notification lookups.
create index if not exists follows_following_idx on public.follows (following_id, created_at desc);
create index if not exists books_user_created_idx on public.books (user_id, created_at desc);
create index if not exists interactions_post_idx on public.interactions (post_id, created_at desc);

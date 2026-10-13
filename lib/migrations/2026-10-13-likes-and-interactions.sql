-- Likes counter, cross-user reads and lookup index for interactions.
--
-- 1. Likes, comments and reactions become readable by everyone, like posts
--    already are; other types (e.g. 'save' bookmarks) stay private. The
--    existing "Gérer ses interactions" policy is `for all`, so it also limited
--    SELECT to the author's own rows: nobody saw notifications or other
--    people's comments.
-- 2. posts.likes_count is kept in sync by a trigger. App code cannot update it:
--    RLS stops a reader from writing someone else's post, so the trigger runs
--    as security definer.
-- 3. Index on (post_id, type) for the trigger's recount and for the
--    notifications query (interactions on my posts).

drop policy if exists "Interactions visibles par tous" on public.interactions;
create policy "Interactions visibles par tous" on public.interactions
  for select using (type in ('like', 'comment', 'reaction'));

create index if not exists interactions_post_type_idx
  on public.interactions (post_id, type);

create or replace function public.sync_post_likes_count() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  pid uuid := coalesce(new.post_id, old.post_id);
begin
  if coalesce(new.type, old.type) <> 'like' then
    return null;
  end if;
  update posts
    set likes_count = (select count(*) from interactions where post_id = pid and type = 'like')
    where id = pid;
  return null;
end $$;

drop trigger if exists interactions_sync_likes_count on public.interactions;
create trigger interactions_sync_likes_count
  after insert or delete on public.interactions
  for each row execute function public.sync_post_likes_count();

-- Backfill existing posts.
update public.posts p
  set likes_count = (select count(*) from public.interactions i where i.post_id = p.id and i.type = 'like');

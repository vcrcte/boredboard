-- Dashboard personalisation and quick reactions.
-- Run once in the Supabase SQL editor, after lib/schema.sql.

-- Feed preferences (modules, themes, order) saved from the dashboard's
-- "Personnaliser" drawer. Without this column they stay in the browser only.
alter table public.profiles add column if not exists preferences jsonb;

-- Quick reactions (👍 🔥 🤔 ❤️) are stored as interactions of type 'reaction',
-- the emoji in `content`. The existing unique (user_id, post_id, type) key
-- keeps one reaction per reader and post.
alter table public.interactions drop constraint if exists interactions_type_check;
alter table public.interactions
  add constraint interactions_type_check check (type in ('like', 'comment', 'save', 'reaction'));

-- Last.fm integration: the listener's Last.fm user name, set in /settings.
alter table public.profiles add column if not exists lastfm_username text;

-- Music sharing: platform, title, cover and player link of a shared track,
-- stored with music posts.
alter table public.posts add column if not exists metadata jsonb;

-- Apple Shortcuts: a personal, long-lived token per user (only its SHA-256 is
-- stored), and a function that publishes a music post for whoever owns the
-- token. Supabase access tokens expire after an hour, which is too short for a
-- token pasted once into a Shortcut.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.shortcut_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token_hash text not null unique,
  created_at timestamp with time zone default now()
);
alter table public.shortcut_tokens enable row level security;
drop policy if exists "Gérer son token de raccourci" on public.shortcut_tokens;
create policy "Gérer son token de raccourci" on public.shortcut_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Runs with the owner's rights (security definer) so it can insert for the
-- token's user; it checks every input itself, as anyone can call it.
create or replace function public.shortcut_share_music(
  p_token text,
  p_title text,
  p_artist text default null,
  p_platform text default null,
  p_link text default null
) returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user uuid;
  v_post uuid;
  v_title text := left(trim(coalesce(p_title, '')), 300);
  v_artist text := nullif(left(trim(coalesce(p_artist, '')), 200), '');
  v_platform text := case lower(coalesce(p_platform, '')) when 'spotify' then 'spotify' else 'apple' end;
  v_link text := case when p_link ~ '^https://(open\.spotify\.com|music\.apple\.com)/' then left(p_link, 500) end;
  v_label text;
begin
  select user_id into v_user from shortcut_tokens
    where token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex');
  if v_user is null then
    raise exception 'invalid_token' using errcode = '28000';
  end if;
  if v_title = '' then
    raise exception 'missing_title' using errcode = '22023';
  end if;

  v_label := case when v_artist is null then v_title else v_title || ' — ' || v_artist end;
  insert into posts (user_id, type, content, category, url, metadata)
  values (
    v_user,
    'musique',
    'J''écoute « ' || v_title || ' »' || coalesce(' — ' || v_artist, ''),
    'Musique',
    v_link,
    case when v_link is null then null else jsonb_build_object(
      'platform', v_platform,
      'type', 'track',
      'title', v_label,
      'thumbnail', null,
      'embed_url', v_link,
      'provider', case v_platform when 'spotify' then 'Spotify' else 'Apple Music' end
    ) end
  )
  returning id into v_post;
  return v_post;
end;
$$;

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

-- Apple Shortcuts: a personal, long-lived token per user. Supabase access
-- tokens expire after an hour, too short for a token pasted once into a
-- Shortcut. The `token` column holds the token's SHA-256, never the token.
create extension if not exists pgcrypto with schema extensions;

create table if not exists public.shortcut_tokens (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  token text not null,
  created_at timestamp with time zone default now()
);
-- Also applies to a table created by hand without these constraints.
create unique index if not exists shortcut_tokens_user_id_key on public.shortcut_tokens (user_id);
create unique index if not exists shortcut_tokens_token_key on public.shortcut_tokens (token);
alter table public.shortcut_tokens enable row level security;
drop policy if exists "Gérer son token de raccourci" on public.shortcut_tokens;
create policy "Gérer son token de raccourci" on public.shortcut_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Shares from the Shortcut are written by the API with the service role key
-- (SUPABASE_SERVICE_ROLE_KEY), after looking the token up: no function needed.
drop function if exists public.shortcut_share_music(text, text, text, text, text);

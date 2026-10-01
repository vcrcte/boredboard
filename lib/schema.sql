-- Table users (profils publics, en plus de auth.users)
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  username text unique not null,
  name text,
  bio text,
  location text,
  avatar_url text,
  interests text[],
  created_at timestamp with time zone default now()
);

-- Table posts
create table public.posts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  type text check (type in ('article', 'reflexion', 'livre', 'musique')) not null,
  content text not null,
  url text,
  category text,
  likes_count integer default 0,
  created_at timestamp with time zone default now()
);

-- Table interactions (likes, commentaires, sauvegardes)
create table public.interactions (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  post_id uuid references public.posts(id) on delete cascade not null,
  type text check (type in ('like', 'comment', 'save')) not null,
  content text,
  created_at timestamp with time zone default now(),
  unique(user_id, post_id, type)
);

-- Table follows (abonnements)
create table public.follows (
  follower_id uuid references public.profiles(id) on delete cascade not null,
  following_id uuid references public.profiles(id) on delete cascade not null,
  created_at timestamp with time zone default now(),
  primary key (follower_id, following_id)
);

-- Table books (livres)
create table public.books (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  author text,
  status text check (status in ('en_cours', 'lu', 'liste')) default 'liste',
  page_current integer default 0,
  page_total integer,
  created_at timestamp with time zone default now()
);

-- Table game_scores (scores de jeux)
create table public.game_scores (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  game_type text not null,
  score integer not null,
  streak integer default 0,
  played_at timestamp with time zone default now()
);

-- RLS : activer la sécurité sur toutes les tables
alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.interactions enable row level security;
alter table public.follows enable row level security;
alter table public.books enable row level security;
alter table public.game_scores enable row level security;

-- Policies : lecture publique des profils et posts
create policy "Profils visibles par tous" on public.profiles for select using (true);
create policy "Posts visibles par tous" on public.posts for select using (true);

-- Policies : écriture uniquement pour l'utilisateur connecté
create policy "Modifier son propre profil" on public.profiles for all using (auth.uid() = id);
create policy "Créer ses propres posts" on public.posts for all using (auth.uid() = user_id);
create policy "Gérer ses interactions" on public.interactions for all using (auth.uid() = user_id);
create policy "Gérer ses abonnements" on public.follows for all using (auth.uid() = follower_id);
create policy "Gérer ses livres" on public.books for all using (auth.uid() = user_id);
create policy "Gérer ses scores" on public.game_scores for all using (auth.uid() = user_id);

-- User portfolio positions
create table if not exists public.user_portfolio (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  symbol text not null,
  quantity numeric not null default 1,
  label text not null default '',
  created_at timestamp with time zone default now()
);

-- User price alerts
create table if not exists public.user_price_alerts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  symbol text not null,
  condition text check (condition in ('above', 'below')) not null,
  target numeric not null,
  label text not null default '',
  created_at timestamp with time zone default now()
);

-- RLS
alter table public.user_portfolio enable row level security;
alter table public.user_price_alerts enable row level security;

create policy "Gérer son portefeuille" on public.user_portfolio for all using (auth.uid() = user_id);
create policy "Gérer ses alertes" on public.user_price_alerts for all using (auth.uid() = user_id);

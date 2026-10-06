-- Migration: create podcast_subscriptions table
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS public.podcast_subscriptions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  source_id text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE (user_id, source_id)
);

-- Enable RLS
ALTER TABLE public.podcast_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Gerer ses abonnements podcasts"
  ON public.podcast_subscriptions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index for fast lookup by user
CREATE INDEX IF NOT EXISTS idx_podcast_subs_user
  ON public.podcast_subscriptions (user_id);

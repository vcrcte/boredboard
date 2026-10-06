-- Migration: add cover_url column to books table
-- Run this in Supabase SQL Editor

-- Add cover_url column (nullable text for Open Library cover URLs)
ALTER TABLE public.books
  ADD COLUMN IF NOT EXISTS cover_url text;

-- Update RLS policy to include cover_url in all operations
-- (The existing "Gerer ses livres" policy already covers all columns,
--  so no RLS changes are needed — new columns are automatically included.)

-- Optional: create an index on status for faster filtered queries
CREATE INDEX IF NOT EXISTS idx_books_status ON public.books (user_id, status);

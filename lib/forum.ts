import { supabase } from "@/lib/supabase";

// ── Types ─────────────────────────────────────────────────────────────

export type ForumPost = {
  id: string;
  user_id: string;
  title: string;
  body: string;
  category: string;
  created_at: string;
  updated_at: string;
  author_name: string;
  reply_count: number;
  last_reply_at: string | null;
};

export type ForumReply = {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
  author_name: string;
};

export const FORUM_CATEGORIES = [
  "Général",
  "Culture",
  "Séries",
  "Musique",
  "Livres",
  "Cinéma",
  "Actualités",
  "Science",
  "Philosophie",
  "Suggestions",
] as const;

export type ForumCategory = (typeof FORUM_CATEGORIES)[number];

// ── Posts ──────────────────────────────────────────────────────────────

export async function getForumPosts(category?: string): Promise<ForumPost[]> {
  let query = supabase
    .from("forum_posts")
    .select("*")
    .order("last_reply_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (category) {
    query = query.eq("category", category);
  }

  const { data } = await query.limit(50);
  return data ?? [];
}

export async function getForumPost(id: string): Promise<ForumPost | null> {
  const { data } = await supabase
    .from("forum_posts")
    .select("*")
    .eq("id", id)
    .single();
  return data ?? null;
}

export async function createForumPost(
  userId: string,
  authorName: string,
  title: string,
  body: string,
  category: string,
): Promise<ForumPost | null> {
  const { data } = await supabase
    .from("forum_posts")
    .insert({
      user_id: userId,
      author_name: authorName,
      title,
      body,
      category,
      reply_count: 0,
      last_reply_at: null,
    })
    .select()
    .single();
  return data ?? null;
}

export async function deleteForumPost(postId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from("forum_posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", userId);
  return !error;
}

// ── Replies ───────────────────────────────────────────────────────────

export async function getPostReplies(postId: string): Promise<ForumReply[]> {
  const { data } = await supabase
    .from("forum_replies")
    .select("*")
    .eq("post_id", postId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

export async function createReply(
  postId: string,
  userId: string,
  authorName: string,
  body: string,
): Promise<ForumReply | null> {
  // Insert reply
  const { data } = await supabase
    .from("forum_replies")
    .insert({ post_id: postId, user_id: userId, author_name: authorName, body })
    .select()
    .single();

  if (data) {
    // Update post reply count and last_reply_at
    const { data: replies } = await supabase
      .from("forum_replies")
      .select("id")
      .eq("post_id", postId);

    await supabase
      .from("forum_posts")
      .update({
        reply_count: replies?.length ?? 1,
        last_reply_at: new Date().toISOString(),
      })
      .eq("id", postId);
  }

  return data ?? null;
}

export async function deleteReply(replyId: string, userId: string, postId: string): Promise<boolean> {
  const { error } = await supabase
    .from("forum_replies")
    .delete()
    .eq("id", replyId)
    .eq("user_id", userId);

  if (!error) {
    // Update reply count
    const { data: replies } = await supabase
      .from("forum_replies")
      .select("id, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: false });

    await supabase
      .from("forum_posts")
      .update({
        reply_count: replies?.length ?? 0,
        last_reply_at: replies?.[0]?.created_at ?? null,
      })
      .eq("id", postId);
  }

  return !error;
}

// ── Helpers ───────────────────────────────────────────────────────────

export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days}j`;
  const months = Math.floor(days / 30);
  return `il y a ${months} mois`;
}

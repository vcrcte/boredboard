import { NextResponse } from "next/server";
import { anonClient } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const POST_SELECT =
  "id, user_id, type, content, url, category, likes_count, created_at, metadata, profiles!posts_user_id_fkey (id, name, username, avatar_url)";

export async function GET() {
  const supabase = anonClient();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: posts, error: postsError } = await supabase
    .from("posts")
    .select(POST_SELECT)
    .gte("created_at", sevenDaysAgo)
    .not("content", "ilike", "%Morceau actuel%")
    .not("content", "ilike", "%Test du Raccourci%")
    .order("created_at", { ascending: false })
    .limit(50);

  if (postsError) {
    return NextResponse.json({ error: postsError.message }, { status: 500 });
  }

  if (!posts?.length) {
    return NextResponse.json({ posts: [], generated_at: new Date().toISOString() });
  }

  const postIds = posts.map((p) => p.id);

  const { data: interactions } = await supabase
    .from("interactions")
    .select("post_id")
    .in("post_id", postIds);

  const counts = new Map<string, number>();
  for (const row of interactions ?? []) {
    counts.set(row.post_id, (counts.get(row.post_id) ?? 0) + 1);
  }

  const ranked = posts
    .map((post) => ({ ...post, interaction_count: counts.get(post.id) ?? 0 }))
    .sort((a, b) => b.interaction_count - a.interaction_count)
    .slice(0, 10);

  return NextResponse.json({ posts: ranked, generated_at: new Date().toISOString() });
}

import { NextResponse } from "next/server";
import { clientForRequest } from "@/lib/supabase-server";
import {
  buildSignals,
  diversify,
  scorePost,
  type RawInteraction,
  type ScoredPost,
} from "@/lib/feed-algorithm";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await clientForRequest(request);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { supabase, user } = auth;
  const userId = user.id;

  // ── 1. Fetch all posts (recent 60, we'll score and return top 30) ────────
  const { data: posts, error: postsErr } = await supabase
    .from("posts")
    .select("id, user_id, type, content, url, category, likes_count, created_at, metadata, profiles (id, name, username, avatar_url)")
    .not("content", "ilike", "%Morceau actuel%")
    .not("content", "ilike", "%Test du Raccourci%")
    .order("created_at", { ascending: false })
    .limit(60);

  if (postsErr) return NextResponse.json({ error: postsErr.message }, { status: 500 });

  // ── 2. Fetch user signals in parallel ────────────────────────────────────
  const [interactionsRes, followsRes, profileRes] = await Promise.all([
    // Last 200 interactions (to build affinity profile)
    supabase
      .from("interactions")
      .select("post_id, type, posts (user_id, type, category)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200),

    // Who the viewer follows
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", userId),

    // Viewer interests
    supabase
      .from("profiles")
      .select("interests")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const interactions = (interactionsRes.data ?? []) as unknown as RawInteraction[];
  const followingIds = (followsRes.data ?? []).map((f) => f.following_id as string);
  const interests: string[] = profileRes.data?.interests ?? [];

  // ── 3. Build signals & score every post ──────────────────────────────────
  const signals = buildSignals(interactions, followingIds, interests);

  // Supabase infers the profiles join as an array; it's a single row at runtime
  const scored = (posts ?? []).map((post) => ({
    ...post,
    likes_count: post.likes_count ?? 0,
    _score: scorePost(
      {
        id: post.id,
        user_id: post.user_id,
        type: post.type,
        category: post.category,
        likes_count: post.likes_count ?? 0,
        created_at: post.created_at,
      },
      signals,
    ),
  })) as unknown as ScoredPost[];

  // Sort by score descending
  scored.sort((a, b) => b._score - a._score);

  // ── 4. Diversify and trim ────────────────────────────────────────────────
  const feed = diversify(scored).slice(0, 30);

  // Strip internal score before sending
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const result = feed.map(({ _score, ...rest }) => rest);

  return NextResponse.json(result);
}

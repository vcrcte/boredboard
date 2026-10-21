import { NextResponse } from "next/server";
import { buildSignals, diversify, scorePost, type RawInteraction, type ScoredPost } from "@/lib/feed-algorithm";
import { buildStats, mergeEntries, type FeedEntry, type FeedScope, type InteractionRow, type Person } from "@/lib/social-feed";
import { clientForRequest } from "@/lib/supabase-server";

// GET /api/social-feed?scope=following|all (signed in).
// following: you and the people you follow, newest first.
// all ("Découvrir"): everyone, ranked by lib/feed-algorithm.
// Each post carries its likes, likers and comments; reading-list changes
// (books) are mixed in as their own entries.

export const dynamic = "force-dynamic";

const POST_SELECT = "id, user_id, type, content, url, category, likes_count, created_at, metadata, profiles!posts_user_id_fkey (id, name, username, avatar_url)";
const LIMIT = 60;

export async function GET(request: Request) {
  const auth = await clientForRequest(request);
  if (!auth) return NextResponse.json({ error: "Connecte-toi" }, { status: 401 });
  const { supabase, user } = auth;
  const scope: FeedScope = new URL(request.url).searchParams.get("scope") === "following" ? "following" : "all";

  const { data: followRows } = await supabase.from("follows").select("following_id").eq("follower_id", user.id);
  const followingIds = (followRows ?? []).map((f) => f.following_id as string);
  const circle = [user.id, ...followingIds];

  let postQuery = supabase
    .from("posts")
    .select(POST_SELECT)
    .not("content", "ilike", "%Morceau actuel%")
    .not("content", "ilike", "%Test du Raccourci%")
    .order("created_at", { ascending: false })
    .limit(scope === "all" ? 100 : LIMIT);
  if (scope === "following") postQuery = postQuery.in("user_id", circle);

  let bookQuery = supabase
    .from("books")
    .select("id, user_id, title, author, cover_url, status, page_current, page_total, created_at, profiles (id, name, username)")
    .order("created_at", { ascending: false })
    .limit(15);
  if (scope === "following") bookQuery = bookQuery.in("user_id", circle);

  const [{ data: posts, error }, { data: books }] = await Promise.all([postQuery, bookQuery]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let ordered = posts ?? [];
  if (scope === "all" && ordered.length) {
    const [interactionsRes, profileRes] = await Promise.all([
      supabase.from("interactions").select("post_id, type, posts (user_id, type, category)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(200),
      supabase.from("profiles").select("interests").eq("id", user.id).maybeSingle(),
    ]);
    const signals = buildSignals((interactionsRes.data ?? []) as unknown as RawInteraction[], followingIds, profileRes.data?.interests ?? []);
    const scored = ordered.map((post) => ({ ...post, likes_count: post.likes_count ?? 0, _score: scorePost({ ...post, likes_count: post.likes_count ?? 0 }, signals) })) as unknown as ScoredPost[];
    scored.sort((a, b) => b._score - a._score);
    const rank = new Map(diversify(scored).map((p, i) => [p.id, i]));
    ordered = ordered.filter((p) => rank.has(p.id)).sort((a, b) => rank.get(a.id)! - rank.get(b.id)!).slice(0, LIMIT);
  }

  const postIds = ordered.map((p) => p.id);
  const { data: rows } = postIds.length
    ? await supabase.from("interactions").select("id, post_id, user_id, type, content, created_at, profiles (id, name, username)").in("post_id", postIds).in("type", ["like", "comment"])
    : { data: [] };
  const stats = buildStats((rows ?? []) as unknown as InteractionRow[], postIds);

  const postEntries: FeedEntry[] = ordered.map((post) => ({ kind: "post", id: post.id, created_at: post.created_at, post, stats: stats[post.id] }));
  const bookEntries: FeedEntry[] = (books ?? []).map((b) => {
    const person = (Array.isArray(b.profiles) ? b.profiles[0] : b.profiles) as Person | null;
    return {
      kind: "book",
      id: `book-${b.id}`,
      created_at: b.created_at,
      person: person ?? { id: b.user_id, name: null, username: "" },
      book: { id: b.id, title: b.title, author: b.author, cover_url: b.cover_url, status: b.status, page_current: b.page_current, page_total: b.page_total },
    };
  });

  return NextResponse.json({ scope, followingCount: followingIds.length, entries: mergeEntries(postEntries, bookEntries, scope) });
}

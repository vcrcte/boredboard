import { NextResponse } from "next/server";
import { isPostId } from "@/lib/share-post";
import { serviceClient } from "@/lib/supabase-server";

// Anonymous, aggregate events from /s/<post id> pages. Receivers have no
// account, so this route is public: it stores no identifier (no cookie, no IP)
// and only accepts a known post and the listed values, so junk can't be logged.

const EVENTS = ["view", "tap", "join_tap"];
const SERVICES = ["spotify", "apple", "deezer", "soundcloud", "youtube"];
const METHODS = ["source", "isrc", "text+duration", "search-fallback", "pending"];

export async function POST(request: Request) {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON invalide" }, { status: 400 });
  }

  const postId = typeof body.post_id === "string" ? body.post_id : "";
  const event = typeof body.event === "string" ? body.event : "";
  const service = body.service === undefined ? null : body.service;
  const method = body.match_method === undefined ? null : body.match_method;

  if (!isPostId(postId) || !EVENTS.includes(event)) return NextResponse.json({ error: "Événement invalide" }, { status: 400 });
  if (service !== null && !SERVICES.includes(String(service))) return NextResponse.json({ error: "Service invalide" }, { status: 400 });
  if (method !== null && !METHODS.includes(String(method))) return NextResponse.json({ error: "Méthode invalide" }, { status: 400 });
  if (event === "tap" && service === null) return NextResponse.json({ error: "Service requis" }, { status: 400 });

  const db = serviceClient();
  if (!db) return new NextResponse(null, { status: 204 });

  const { data: post } = await db.from("posts").select("id").eq("id", postId).maybeSingle();
  if (!post) return NextResponse.json({ error: "Post introuvable" }, { status: 404 });

  // An insert error (e.g. the migration isn't run yet) must not break the page: the event is just not stored.
  await db.from("share_events").insert({ post_id: postId, event, service, match_method: method });
  return new NextResponse(null, { status: 204 });
}

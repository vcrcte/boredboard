import { NextResponse } from "next/server";
import { shareMusicLink } from "@/lib/share-music";
import { clientForRequest } from "@/lib/supabase-server";

// POST { url } from /partager, signed in (Authorization: Bearer <access token>).
// Posts the link to the user's feed and returns its share link.
export async function POST(request: Request) {
  const auth = await clientForRequest(request);
  if (!auth) return NextResponse.json({ error: "Connecte-toi pour partager." }, { status: 401 });

  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Requête invalide" }, { status: 400 });
  }

  const result = await shareMusicLink(auth.supabase, auth.user.id, body.url, new URL(request.url).origin);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ share_url: result.shareUrl, title: result.title });
}

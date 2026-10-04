import { NextResponse } from "next/server";
import { anonClient } from "@/lib/supabase-server";

// Called by the Apple Shortcut with the personal token from /raccourci. The
// database function checks the token and publishes the post for its owner.

/** Shortcuts can't give a track link, so the post links to a search on the platform. */
function searchLink(platform: string, query: string) {
  return platform === "spotify"
    ? `https://open.spotify.com/search/${encodeURIComponent(query)}`
    : `https://music.apple.com/search?term=${encodeURIComponent(query)}`;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const artist = typeof body?.artist === "string" ? body.artist.trim() : "";
  const platform = typeof body?.platform === "string" && body.platform.toLowerCase() === "spotify" ? "spotify" : "apple";

  if (!token) return NextResponse.json({ error: "Token requis" }, { status: 401 });
  if (!title) return NextResponse.json({ error: "Titre requis" }, { status: 400 });

  const { data, error } = await anonClient().rpc("shortcut_share_music", {
    p_token: token,
    p_title: title,
    p_artist: artist || null,
    p_platform: platform,
    p_link: searchLink(platform, artist ? `${title} ${artist}` : title),
  });

  if (error) {
    if (error.message.includes("invalid_token")) {
      return NextResponse.json({ error: "Token invalide — génères-en un nouveau sur /raccourci" }, { status: 401 });
    }
    if (/shortcut_share_music/.test(error.message)) {
      return NextResponse.json({ error: "Le raccourci n'est pas encore activé : exécute la migration Supabase." }, { status: 503 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: `"${title}" partagé sur BoredBoard !`, post_id: data });
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { GET as resolveEmbed } from "@/app/api/music/embed/route";
import { PLATFORMS, parseEmbed, safeHttps, type MusicPlatform } from "@/lib/music";

// Publishes a music post for the browser extension. The site keeps its
// Supabase session in the browser's storage, not in cookies, so the extension
// signs in on its own and sends its access token as "Authorization: Bearer …";
// the insert then runs as that user, under the table's row-level security.

type IncomingTrack = {
  platform?: string;
  kind?: string;
  title?: string;
  artist?: string;
  cover?: string | null;
  url?: string | null;
  pageUrl?: string | null;
};

const limit = (value: unknown, max: number) => (typeof value === "string" ? value.trim().slice(0, max) : "");

export async function POST(request: Request) {
  const token = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  if (!user) return NextResponse.json({ error: "Session expirée, reconnecte-toi" }, { status: 401 });

  const body = (await request.json().catch(() => null)) as { track?: IncomingTrack; comment?: string } | null;
  const track = body?.track;
  const title = limit(track?.title, 300);
  const platform = track?.platform as MusicPlatform | undefined;
  if (!track || !title || !platform || !(platform in PLATFORMS)) {
    return NextResponse.json({ error: "Morceau invalide" }, { status: 400 });
  }

  const artist = limit(track.artist, 200);
  const link = safeHttps(track.url) ?? safeHttps(track.pageUrl);

  // Canonical title and cover from the platform when the link is recognised,
  // otherwise what the extension read on the page.
  let metadata = parseEmbed({
    platform,
    type: track.kind,
    title: artist ? `${title} — ${artist}` : title,
    thumbnail: track.cover,
    embed_url: link,
  });
  if (link) {
    const resolved = await resolveEmbed(new Request(`http://local/api/music/embed?url=${encodeURIComponent(link)}`));
    if (resolved.ok) metadata = parseEmbed(await resolved.json()) ?? metadata;
  }

  const post = {
    user_id: user.id,
    type: "musique",
    content: limit(body?.comment, 2000) || `J'écoute ${artist ? `${title} — ${artist}` : title}`,
    url: link,
    category: "Musique",
  };

  let { error } = await supabase.from("posts").insert({ ...post, metadata });
  // Before the posts.metadata column exists, publish without it: the feed looks the link up again.
  if (error && /metadata/i.test(error.message)) ({ error } = await supabase.from("posts").insert(post));

  if (error) {
    // posts.user_id references profiles: the profile is created on the first visit to the site.
    if (error.code === "23503") {
      return NextResponse.json({ error: "Ouvre BoredBoard une première fois pour créer ton profil." }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

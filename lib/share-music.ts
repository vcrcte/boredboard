// Posts a shared music link to the sharer's feed and returns its universal
// share link (/s/<post id>). Used by /partager (signed-in web page) and the
// iOS Shortcut route.

import type { SupabaseClient } from "@supabase/supabase-js";

export type ShareResult = { ok: true; shareUrl: string; title: string } | { ok: false; status: number; error: string };

/** Apps share text around the link ("Écoute X sur Spotify https://…"): keep the link only. */
export function extractLink(text: unknown): string | null {
  return typeof text === "string" ? (/https:\/\/\S+/.exec(text)?.[0] ?? null) : null;
}

export async function shareMusicLink(db: SupabaseClient, userId: string, text: unknown, origin: string): Promise<ShareResult> {
  const url = extractLink(text);
  if (!url) return { ok: false, status: 400, error: "Aucun lien trouvé : copie le lien du morceau dans ton appli." };

  let embed: Record<string, unknown> | null = null;
  try {
    // This deployment's own embed route (lib/music.ts format, read by the feed's player card).
    const res = await fetch(`${origin}/api/music/embed?url=${encodeURIComponent(url)}`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) embed = await res.json();
  } catch {
    // Treated as not recognised below.
  }
  if (!embed?.embed_url) return { ok: false, status: 400, error: "Lien non reconnu : partage un lien Spotify, Deezer, SoundCloud, YouTube ou Apple Music." };

  const title = typeof embed.title === "string" && embed.title ? embed.title : "Titre inconnu";
  const { data, error } = await db
    .from("posts")
    .insert({
      user_id: userId,
      type: "musique",
      content: `J'écoute "${title}"`,
      url,
      category: "Musique",
      // Matching for the share link runs on its first view and fills metadata.matches.
      metadata: { ...embed, url },
      likes_count: 0,
    })
    .select("id")
    .single();
  if (error || !data) return { ok: false, status: 500, error: error?.message ?? "Erreur serveur" };

  return { ok: true, shareUrl: `${process.env.NEXT_PUBLIC_SITE_URL ?? origin}/s/${data.id}`, title };
}

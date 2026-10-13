// Server-side loading for universal share links (/s/<post id>).
// Matching runs on the link's first view (usually the chat app's preview bot,
// right when the curator pastes the link): Next 14 has no after() to run it
// once the Shortcut has its reply. Results are merged into posts.metadata.

import { detectPlatform, parseEmbed, safeHttps } from "@/lib/music";
import { resolveMatches, searchUrl, SERVICES, sourceTrack, type MatchMethod, type Matches, type Service } from "@/lib/music-match";
import { anonClient, serviceClient } from "@/lib/supabase-server";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Whole resolve budget for one view; past it the page renders search links and the next view retries. */
const RESOLVE_BUDGET_MS = 5000;
const MAX_ATTEMPTS = 3;
const METHODS: MatchMethod[] = ["source", "isrc", "text+duration", "search-fallback"];

export interface SharedTrack {
  id: string;
  userId: string;
  sharer: string;
  title: string;
  artist: string;
  cover: string | null;
  source: Service;
  matches: Matches;
  /** True when some services show a search link only because matching is still pending. */
  pending: boolean;
}

export interface ShelfItem {
  id: string;
  title: string;
  cover: string | null;
}

type Row = {
  id: string;
  user_id: string;
  type: string;
  url: string | null;
  content: string;
  metadata: Record<string, unknown> | null;
  profiles: { name: string | null; username: string } | { name: string | null; username: string }[] | null;
};

export const isPostId = (value: string) => UUID.test(value);

async function loadRow(id: string): Promise<Row | null> {
  if (!isPostId(id)) return null;
  const db = serviceClient() ?? anonClient();
  const { data } = await db
    .from("posts")
    .select("id, user_id, type, url, content, metadata, profiles (name, username)")
    .eq("id", id)
    .maybeSingle();
  return data && (data as Row).type === "musique" ? (data as Row) : null;
}

/** "Title — Artist" as stored by the share routes, split back into its parts. */
function titleAndArtist(row: Row) {
  const embed = parseEmbed(row.metadata);
  const meta = row.metadata ?? {};
  const raw = embed?.title ?? (typeof meta.title === "string" ? meta.title : row.content.replace(/^J'écoute "?|"$/g, ""));
  const artist = embed?.artist ?? (typeof meta.artist === "string" ? meta.artist : "");
  const [title, fromTitle] = raw.split(" — ");
  return { title: title.trim(), artist: (artist || fromTitle || "").trim() };
}

function sharerName(row: Row) {
  const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
  return profile?.name || profile?.username || "Quelqu'un";
}

function coverOf(metadata: Record<string, unknown> | null) {
  return safeHttps(metadata?.thumbnail) ?? safeHttps(metadata?.artwork) ?? null;
}

function storedMatches(metadata: Record<string, unknown> | null): Matches | null {
  const raw = metadata?.matches;
  if (!raw || typeof raw !== "object") return null;
  const matches: Matches = {};
  for (const service of SERVICES) {
    const link = (raw as Record<string, { url?: unknown; method?: unknown }>)[service];
    const url = safeHttps(link?.url);
    const method = METHODS.find((known) => known === link?.method);
    if (url && method) matches[service] = { url, method };
  }
  return Object.keys(matches).length ? matches : null;
}

async function resolveAndStore(row: Row, source: Service, sharedUrl: string, fallback: { title: string; artist: string }) {
  const embed = parseEmbed(row.metadata);
  const url = new URL(sharedUrl);
  const track = embed?.type === "track" || !embed ? await sourceTrack(source, url) : null;
  const { matches, retry } = await resolveMatches(source, sharedUrl, track, fallback);

  const db = serviceClient();
  if (db) {
    // Re-read so a concurrent first view (preview bot + a person) can't drop other metadata fields.
    const { data } = await db.from("posts").select("metadata").eq("id", row.id).maybeSingle();
    const latest = (data?.metadata as Record<string, unknown> | null) ?? row.metadata ?? {};
    const attempts = typeof latest.matches_attempts === "number" ? latest.matches_attempts : 0;
    await db
      .from("posts")
      .update({ metadata: { ...latest, matches, matches_retry: retry, matches_attempts: attempts + 1 } })
      .eq("id", row.id);
  }
  return matches;
}

/** The shared track with a link for every service, resolving matches on first view. null when not found. */
export async function loadSharedTrack(id: string): Promise<SharedTrack | null> {
  const row = await loadRow(id);
  if (!row) return null;
  const meta = row.metadata ?? {};
  const sharedUrl = safeHttps(meta.source_url) ?? safeHttps(row.url);
  const { title, artist } = titleAndArtist(row);
  const embed = parseEmbed(row.metadata);
  const source: Service = embed?.platform ?? (sharedUrl ? detectPlatform(new URL(sharedUrl)) : null) ?? "spotify";

  let matches = storedMatches(row.metadata);
  let pending = false;
  const retry = Array.isArray(meta.matches_retry) ? meta.matches_retry : [];
  const attempts = typeof meta.matches_attempts === "number" ? meta.matches_attempts : 0;

  if (sharedUrl && (!matches || retry.length > 0) && attempts < MAX_ATTEMPTS) {
    const resolved = await Promise.race([
      resolveAndStore(row, source, sharedUrl, { title, artist }).catch(() => null),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), RESOLVE_BUDGET_MS)),
    ]);
    if (resolved) matches = resolved;
  }

  if (!matches) {
    // Nothing stored yet (or no shared link): the shared link plus search links, marked pending.
    pending = Boolean(sharedUrl);
    matches = {};
    for (const service of SERVICES) {
      matches[service] = service === source && sharedUrl ? { url: sharedUrl, method: "source" } : { url: searchUrl(service, { title, artist }), method: "search-fallback" };
    }
  }

  return { id: row.id, userId: row.user_id, sharer: sharerName(row), title, artist, cover: coverOf(row.metadata), source, matches, pending };
}

/** The sharer's last 8 music posts (their shelf), newest first. */
export async function loadShelf(userId: string): Promise<ShelfItem[]> {
  const db = serviceClient() ?? anonClient();
  const { data } = await db
    .from("posts")
    .select("id, content, metadata")
    .eq("user_id", userId)
    .eq("type", "musique")
    .order("created_at", { ascending: false })
    .limit(8);
  return (data ?? []).map((post) => {
    const embed = parseEmbed(post.metadata);
    return { id: post.id, title: (embed?.title ?? post.content).split(" — ")[0], cover: coverOf(post.metadata) };
  });
}

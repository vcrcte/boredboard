// Music links shared in posts: the metadata stored with a post (posts.metadata)
// and the platform list, shared by the embed route and the pages.

export type MusicPlatform = "spotify" | "apple" | "deezer" | "soundcloud" | "youtube";

export type MusicKind = "track" | "album" | "playlist";

export interface MusicEmbed {
  platform: MusicPlatform;
  /** Missing on posts saved before albums and playlists were supported: a single track. */
  type?: MusicKind;
  title: string;
  /** Read separately from the title where the platform gives it (Spotify, SoundCloud). */
  artist?: string;
  thumbnail: string | null;
  embed_url: string;
  provider: string;
}

export const PLATFORMS: Record<MusicPlatform, { label: string; background: string; color: string; hosts: string[] }> = {
  spotify: { label: "Spotify", background: "rgba(30,215,96,0.1)", color: "#1DB954", hosts: ["open.spotify.com", "spotify.com"] },
  apple: { label: "Apple Music", background: "rgba(252,60,68,0.1)", color: "#FC3C44", hosts: ["music.apple.com"] },
  deezer: { label: "Deezer", background: "rgba(239,100,0,0.1)", color: "#EF6400", hosts: ["deezer.com", "www.deezer.com"] },
  soundcloud: { label: "SoundCloud", background: "rgba(255,85,0,0.1)", color: "#FF5500", hosts: ["soundcloud.com"] },
  youtube: {
    label: "YouTube Music",
    background: "rgba(255,0,0,0.1)",
    color: "#FF0000",
    hosts: ["youtube.com", "www.youtube.com", "m.youtube.com", "music.youtube.com", "youtu.be"],
  },
};

/** The platform of a shared link, read from its host name (not a substring of the whole URL). */
export function detectPlatform(url: URL): MusicPlatform | null {
  const host = url.hostname.toLowerCase();
  const entry = (Object.keys(PLATFORMS) as MusicPlatform[]).find((platform) =>
    PLATFORMS[platform].hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`)),
  );
  return entry ?? null;
}

/**
 * Short links the mobile apps share instead of the full URL. They redirect to
 * one of the platforms above, so they are expanded before detectPlatform.
 */
export const SHORT_LINK_HOSTS = ["spotify.link", "deezer.page.link", "link.deezer.com", "on.soundcloud.com"];

export function isShortLink(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  return SHORT_LINK_HOSTS.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

/**
 * Follows a short link's redirects (at most 3) until it reaches a supported
 * platform. Only short-link hosts are requested, so this can't be pointed at an
 * arbitrary server. Returns null when it ends anywhere else.
 */
export async function expandShortLink(url: URL): Promise<URL | null> {
  let current = url;
  for (let hop = 0; hop < 3; hop++) {
    if (detectPlatform(current)) return current;
    if (!isShortLink(current)) return null;
    const res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(3000) });
    const location = res.headers.get("location");
    if (!location) return null;
    current = new URL(location, current);
  }
  return detectPlatform(current) ? current : null;
}

/** Only https links are rendered, so a hand-edited metadata row can't inject a script URL. */
export function safeHttps(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    return new URL(value).protocol === "https:" ? value : null;
  } catch {
    return null;
  }
}

/** Validates metadata read back from the database. */
export function parseEmbed(value: unknown): MusicEmbed | null {
  const raw = (typeof value === "string" ? safeJson(value) : value) as Partial<MusicEmbed> | null;
  if (!raw || typeof raw.title !== "string" || !raw.platform || !(raw.platform in PLATFORMS)) return null;
  const embedUrl = safeHttps(raw.embed_url);
  if (!embedUrl) return null;
  return {
    platform: raw.platform,
    type: raw.type === "album" || raw.type === "playlist" ? raw.type : "track",
    title: raw.title,
    artist: typeof raw.artist === "string" ? raw.artist : undefined,
    thumbnail: safeHttps(raw.thumbnail),
    embed_url: embedUrl,
    provider: PLATFORMS[raw.platform].label,
  };
}

function safeJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function fetchEmbed(url: string): Promise<MusicEmbed> {
  const res = await fetch(`/api/music/embed?url=${encodeURIComponent(url)}`);
  const data = await res.json();
  const embed = res.ok ? parseEmbed(data) : null;
  if (!embed) throw new Error(data.error ?? "Lien non reconnu");
  return embed;
}

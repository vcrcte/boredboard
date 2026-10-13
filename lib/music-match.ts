// Cross-service matching for universal share links (/s/<post id>).
// A shared track is looked up on the other services so each receiver can open
// it in their own app. docs/designs/first-20-users.md describes the rules:
// an exact ISRC match, or the same normalized title and artist with durations
// within ±3 s; anything else gets a search link instead of a guess.

import type { MusicPlatform } from "@/lib/music";

export type Service = MusicPlatform;

/** Button order on the receiver page (after the primary button). */
export const SERVICES: Service[] = ["spotify", "apple", "deezer", "soundcloud", "youtube"];

/** How a service's link was obtained. "source" is the link that was shared. */
export type MatchMethod = "source" | "isrc" | "text+duration" | "search-fallback";

export interface ServiceLink {
  url: string;
  method: MatchMethod;
}

export type Matches = Partial<Record<Service, ServiceLink>>;

export interface TrackInfo {
  title: string;
  artist: string;
  /** Seconds. */
  duration?: number;
  isrc?: string;
}

const DURATION_TOLERANCE = 3;
const SERVICE_TIMEOUT_MS = 4000;

// ── Pure helpers (unit-tested) ───────────────────────────────────────────────

const stripAccents = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "");

/** Lowercase, no accents, no "(feat. …)" or "- Remastered 2011" parts, no punctuation. */
export function normalizeTitle(title: string): string {
  return stripAccents(title.toLowerCase())
    .replace(/[([](feat|ft|with)\.?\s[^)\]]*[)\]]/g, " ")
    .replace(/\s(feat|ft)\.?\s.*$/, " ")
    .replace(/\s-\s.*\b(remaster(ed)?|version|edit|mix)\b.*$/, " ")
    .replace(/[([][^)\]]*\b(remaster(ed)?)\b[^)\]]*[)\]]/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** The individual artists in a credit ("A & B", "A, B", "A feat. B", "A x B"). */
export function splitArtists(artist: string): string[] {
  return stripAccents(artist.toLowerCase())
    .split(/\s*(?:,|&|\+|\bfeat\.?|\bft\.?|\bx\b|\bet\b|\band\b)\s*/)
    .map((part) => part.replace(/[^a-z0-9]+/g, " ").trim())
    .filter(Boolean);
}

/** True when the two credits share at least one artist (services credit features differently). */
export function artistsOverlap(a: string, b: string): boolean {
  const left = new Set(splitArtists(a));
  return splitArtists(b).some((name) => left.has(name));
}

/** How a candidate matches the shared track, or null when it isn't the same recording. */
export function acceptMatch(source: TrackInfo, candidate: TrackInfo): Exclude<MatchMethod, "source" | "search-fallback"> | null {
  if (source.isrc && candidate.isrc && source.isrc.toUpperCase() === candidate.isrc.toUpperCase()) return "isrc";
  if (source.duration === undefined || candidate.duration === undefined) return null;
  if (Math.abs(source.duration - candidate.duration) > DURATION_TOLERANCE) return null;
  if (normalizeTitle(source.title) !== normalizeTitle(candidate.title)) return null;
  return artistsOverlap(source.artist, candidate.artist) ? "text+duration" : null;
}

/** A search on the service for "artist title": the fallback when there is no accepted match. */
export function searchUrl(service: Service, track: Pick<TrackInfo, "title" | "artist">): string {
  const query = `${track.artist} ${track.title}`.trim();
  const q = encodeURIComponent(query);
  switch (service) {
    case "spotify":
      return `https://open.spotify.com/search/${q}`;
    case "apple":
      return `https://music.apple.com/fr/search?term=${q}`;
    case "deezer":
      return `https://www.deezer.com/search/${q}`;
    case "soundcloud":
      return `https://soundcloud.com/search?q=${q}`;
    case "youtube":
      return `https://www.youtube.com/results?search_query=${q}`;
  }
}

const meta = (html: string, key: string) =>
  new RegExp(`<meta[^>]*(?:property|name)="${key.replace(/[:.]/g, "\\$&")}"[^>]*content="([^"]*)"`, "i").exec(html)?.[1] ?? null;

const decodeEntities = (value: string) =>
  value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");

/** Title, artist, duration and cover from an open.spotify.com track page (no API key needed). */
export function parseSpotifyPage(html: string): (TrackInfo & { image: string | null }) | null {
  const title = meta(html, "og:title");
  if (!title) return null;
  const artist = meta(html, "music:musician_description") ?? meta(html, "og:description")?.split(" · ")[0] ?? "";
  const duration = Number(meta(html, "music:duration"));
  return {
    title: decodeEntities(title),
    artist: decodeEntities(artist),
    duration: Number.isFinite(duration) && duration > 0 ? duration : undefined,
    image: meta(html, "og:image"),
  };
}

/** SoundCloud oEmbed titles read "Track by Uploader"; the uploader is usually the artist. */
export function parseSoundCloudTitle(title: string, author: string | undefined): Pick<TrackInfo, "title" | "artist"> {
  const suffix = author ? ` by ${author}` : null;
  if (suffix && title.endsWith(suffix)) return { title: title.slice(0, -suffix.length), artist: author! };
  const at = title.lastIndexOf(" by ");
  if (at > 0) return { title: title.slice(0, at), artist: author ?? title.slice(at + 4) };
  return { title, artist: author ?? "" };
}

/** The button shown first: the receiver's last choice when it's available, else the shared link's service. */
export function primaryService(source: Service, remembered: string | null, matches: Matches): Service {
  const choice = SERVICES.find((service) => service === remembered);
  return choice && matches[choice] ? choice : source;
}

// ── Network (bounded, keyless public endpoints) ───────────────────────────────

async function getJson(url: string) {
  const res = await fetch(url, { signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS), headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

/** Reads the shared track from its own service. null for albums, playlists and unknown links. */
export async function sourceTrack(service: Service, url: URL): Promise<TrackInfo | null> {
  try {
    if (service === "spotify") {
      if (!/\/track\//.test(url.pathname)) return null;
      const res = await fetch(`https://open.spotify.com${url.pathname}`, {
        signal: AbortSignal.timeout(SERVICE_TIMEOUT_MS),
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      return res.ok ? parseSpotifyPage(await res.text()) : null;
    }
    if (service === "deezer") {
      const id = /\/track\/(\d+)/.exec(url.pathname)?.[1];
      if (!id) return null;
      const item = await getJson(`https://api.deezer.com/track/${id}`);
      return item?.title && !item.error ? { title: item.title, artist: item.artist?.name ?? "", duration: item.duration, isrc: item.isrc } : null;
    }
    if (service === "apple") {
      const id = url.searchParams.get("i") ?? (/\/song\//.test(url.pathname) ? url.pathname.split("/").pop() : null);
      if (!id || !/^\d+$/.test(id)) return null;
      const country = /^\/([a-z]{2})\//i.exec(url.pathname)?.[1]?.toLowerCase() ?? "fr";
      const item = (await getJson(`https://itunes.apple.com/lookup?id=${id}&country=${country}`))?.results?.[0];
      return item?.trackName ? { title: item.trackName, artist: item.artistName ?? "", duration: item.trackTimeMillis ? item.trackTimeMillis / 1000 : undefined } : null;
    }
    if (service === "soundcloud") {
      const data = await getJson(`https://soundcloud.com/oembed?format=json&url=${encodeURIComponent(url.href)}`);
      return data?.title ? parseSoundCloudTitle(data.title, data.author_name) : null;
    }
    return null;
  } catch {
    return null;
  }
}

async function findOnDeezer(track: TrackInfo): Promise<ServiceLink | null> {
  if (track.isrc) {
    const item = await getJson(`https://api.deezer.com/track/isrc:${encodeURIComponent(track.isrc)}`).catch(() => null);
    if (item?.link && !item.error) return { url: item.link, method: "isrc" };
  }
  // Deezer's advanced syntax (artist:"…" track:"…") returns nothing as of 2026-10; a plain query works and the acceptance rule filters it.
  const query = `${track.artist} ${track.title}`;
  const data = await getJson(`https://api.deezer.com/search?q=${encodeURIComponent(query)}&limit=5`);
  for (const item of data?.data ?? []) {
    const method = acceptMatch(track, { title: item.title, artist: item.artist?.name ?? "", duration: item.duration });
    if (method && item.link) return { url: item.link, method };
  }
  return null;
}

async function findOnApple(track: TrackInfo): Promise<ServiceLink | null> {
  const term = encodeURIComponent(`${track.artist} ${track.title}`);
  const data = await getJson(`https://itunes.apple.com/search?term=${term}&media=music&entity=song&country=fr&limit=5`);
  for (const item of data?.results ?? []) {
    const candidate = { title: item.trackName ?? "", artist: item.artistName ?? "", duration: item.trackTimeMillis ? item.trackTimeMillis / 1000 : undefined };
    const method = acceptMatch(track, candidate);
    if (method && item.trackViewUrl) return { url: item.trackViewUrl, method };
  }
  return null;
}

/**
 * Links for every service: the shared link for its own service, an accepted
 * match on Deezer and Apple when one exists, and a search link everywhere else
 * (Spotify without an API key, YouTube and SoundCloud are search-only).
 * `retry` lists the services whose lookup failed (timeout, HTTP error) rather
 * than finding no match: they keep a search link until a later view retries.
 */
export async function resolveMatches(
  source: Service,
  sharedUrl: string,
  track: TrackInfo | null,
  fallback: Pick<TrackInfo, "title" | "artist">,
): Promise<{ matches: Matches; retry: Service[] }> {
  const info = track ?? { ...fallback };
  const lookups: [Service, () => Promise<ServiceLink | null>][] = track
    ? [
        ["deezer", () => findOnDeezer(track)],
        ["apple", () => findOnApple(track)],
      ]
    : [];
  const found: Partial<Record<Service, ServiceLink>> = {};
  const retry: Service[] = [];
  await Promise.all(
    lookups
      .filter(([service]) => service !== source)
      .map(async ([service, lookup]) => {
        try {
          const link = await lookup();
          if (link) found[service] = link;
        } catch {
          retry.push(service);
        }
      }),
  );
  const matches: Matches = {};
  for (const service of SERVICES) {
    matches[service] =
      service === source ? { url: sharedUrl, method: "source" } : (found[service] ?? { url: searchUrl(service, info), method: "search-fallback" });
  }
  return { matches, retry };
}

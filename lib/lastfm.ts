// Shared between the Last.fm API routes (server) and the pages (client).

/** Last.fm user names: 2–15 characters, letters first, then letters, digits, "-" or "_". */
export const LASTFM_USERNAME = /^[A-Za-z][A-Za-z0-9_-]{1,14}$/;

export type LastfmTrack = {
  name: string;
  artist: string;
  url: string | null;
  image: string | null;
  nowPlaying: boolean;
  /** Unix time in ms; null while the track is still playing. */
  playedAt: number | null;
};

type RawTrack = {
  name?: string;
  url?: string;
  artist?: { "#text"?: string; name?: string };
  image?: { "#text"?: string; size?: string }[];
  date?: { uts?: string };
  "@attr"?: { nowplaying?: string };
};

/** Normalises the `recenttracks` or `toptracks` payload returned by Last.fm. */
export function parseTracks(data: unknown): LastfmTrack[] {
  const root = data as { recenttracks?: { track?: RawTrack | RawTrack[] }; toptracks?: { track?: RawTrack | RawTrack[] } };
  const raw = root?.recenttracks?.track ?? root?.toptracks?.track ?? [];
  // Last.fm returns an object instead of an array when there is a single track.
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .filter((track) => track?.name)
    .map((track) => ({
      name: track.name!,
      artist: track.artist?.["#text"] ?? track.artist?.name ?? "",
      url: track.url ?? null,
      image: track.image?.find((item) => item.size === "medium")?.["#text"] || null,
      nowPlaying: track["@attr"]?.nowplaying === "true",
      playedAt: track.date?.uts ? Number(track.date.uts) * 1000 : null,
    }));
}

/** The latest tracks of a Last.fm user, newest first; throws when Last.fm can't be reached. */
export async function fetchRecentTracks(username: string, limit = 5): Promise<LastfmTrack[]> {
  const res = await fetch(`/api/music/lastfm?username=${encodeURIComponent(username)}&limit=${limit}`);
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.message ?? "Last.fm indisponible");
  return parseTracks(data);
}

export function playedAgo(track: LastfmTrack) {
  if (track.nowPlaying || !track.playedAt) return "en ce moment";
  const minutes = Math.floor((Date.now() - track.playedAt) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "hier" : `il y a ${days}j`;
}

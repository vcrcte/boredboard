import { NextResponse } from "next/server";
import { detectPlatform, type MusicEmbed, type MusicKind } from "@/lib/music";

// Title and cover of a shared music link, from each platform's public,
// key-less endpoints. The platforms' own embed HTML is never passed on.

const CACHE = { next: { revalidate: 86_400 } };

async function getJson(url: string) {
  const res = await fetch(url, { ...CACHE, headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function spotify(url: URL): Promise<MusicEmbed | null> {
  // open.spotify.com/{track|album|playlist}/<id>, possibly after a locale segment ("intl-fr").
  const kind = /\/(track|album|playlist)\//.exec(url.pathname)?.[1] as MusicKind | undefined;
  if (!kind) return null;
  const data = await getJson(`https://open.spotify.com/oembed?url=${encodeURIComponent(url.href)}`);
  if (!data?.title) return null;
  return {
    platform: "spotify",
    type: kind,
    title: data.title,
    thumbnail: data.thumbnail_url ?? null,
    embed_url: data.iframe_url || url.href,
    provider: "Spotify",
  };
}

// Apple Music has no public oEmbed endpoint; the iTunes lookup API returns the
// same information from the track id (?i=) or the album id (last path segment).
// Links shared from an iPhone look like music.apple.com/fr/album/<album-name>/<album-id>?i=<track-id>.
async function apple(url: URL): Promise<MusicEmbed | null> {
  const parts = url.pathname.split("/").filter(Boolean);
  // The store in the link ("fr"): a track sold only there is missing from the default US store.
  const country = /^[a-z]{2}$/i.test(parts[0] ?? "") ? `&country=${parts[0].toLowerCase()}` : "";
  const id = url.searchParams.get("i") ?? parts[parts.length - 1];

  let result = id && /^\d+$/.test(id) ? (await getJson(`https://itunes.apple.com/lookup?id=${id}${country}`))?.results?.[0] : null;

  // No usable id: search the name written in the link. After /album/ it is the
  // album's name, so the search then looks for the album itself.
  if (!result) {
    const index = parts.findIndex((part) => part === "song" || part === "album");
    const slug = index >= 0 ? parts[index + 1] : undefined;
    const name = slug && !/^\d+$/.test(slug) ? decodeURIComponent(slug).replace(/-/g, " ").trim() : "";
    if (!name) return null;
    const entity = parts[index] === "song" ? "song" : "album";
    result = (await getJson(`https://itunes.apple.com/search?term=${encodeURIComponent(name)}&media=music&entity=${entity}&limit=1${country}`))?.results?.[0];
    if (!result) return null;
  }

  const title = result.trackName ?? result.collectionName;
  return {
    platform: "apple",
    type: result.wrapperType === "track" ? "track" : "album",
    title: result.artistName ? `${title} — ${result.artistName}` : title,
    // The lookup returns 100px artwork; the same URL serves larger sizes.
    thumbnail: result.artworkUrl100?.replace("100x100bb", "300x300bb") ?? null,
    embed_url: url.href,
    provider: "Apple Music",
  };
}

async function deezer(url: URL): Promise<MusicEmbed | null> {
  const match = /\/(track|album|playlist)\/(\d+)/.exec(url.pathname);
  if (!match) return null;
  const [, kind, id] = match as unknown as [string, MusicKind, string];
  const item = await getJson(`https://api.deezer.com/${kind}/${id}`);
  if (!item?.title || item.error) return null;
  return {
    platform: "deezer",
    type: kind,
    title: item.artist?.name ? `${item.title} — ${item.artist.name}` : item.title,
    thumbnail: (kind === "track" ? item.album?.cover_medium : kind === "playlist" ? item.picture_medium : item.cover_medium) ?? null,
    embed_url: `https://widget.deezer.com/widget/dark/${kind}/${id}`,
    provider: "Deezer",
  };
}

async function youtube(url: URL): Promise<MusicEmbed | null> {
  const videoId = url.hostname === "youtu.be" ? url.pathname.slice(1) : url.searchParams.get("v");
  const playlistId = url.searchParams.get("list");

  // A playlist link without a video in it (a video "inside" a playlist is shared as that video).
  if (!videoId && playlistId && /^[\w-]{10,64}$/.test(playlistId)) {
    const data = await getJson(
      `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/playlist?list=${playlistId}`)}&format=json`,
    ).catch(() => null);
    return {
      platform: "youtube",
      type: "playlist",
      title: data?.title ?? "Playlist YouTube",
      thumbnail: data?.thumbnail_url ?? null,
      embed_url: `https://www.youtube.com/embed/videoseries?list=${playlistId}`,
      provider: "YouTube Music",
    };
  }

  if (!videoId || !/^[\w-]{6,20}$/.test(videoId)) return null;
  const data = await getJson(`https://www.youtube.com/oembed?url=${encodeURIComponent(url.href)}&format=json`);
  if (!data?.title) return null;
  return {
    platform: "youtube",
    type: "track",
    title: data.title,
    thumbnail: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
    embed_url: `https://www.youtube.com/embed/${videoId}`,
    provider: "YouTube Music",
  };
}

const RESOLVERS = { spotify, apple, deezer, youtube };

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url");
  if (!raw) return NextResponse.json({ error: "URL required" }, { status: 400 });

  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return NextResponse.json({ error: "Lien invalide" }, { status: 400 });
  }
  const platform = url.protocol === "https:" || url.protocol === "http:" ? detectPlatform(url) : null;
  if (!platform) return NextResponse.json({ error: "Plateforme non supportée" }, { status: 400 });

  try {
    const embed = await RESOLVERS[platform](url);
    if (!embed) return NextResponse.json({ error: "Morceau introuvable" }, { status: 404 });
    return NextResponse.json(embed);
  } catch {
    return NextResponse.json({ error: "Impossible de récupérer les métadonnées" }, { status: 502 });
  }
}

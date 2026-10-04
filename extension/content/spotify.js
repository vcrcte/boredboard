// Spotify Web: the track in the "Now playing" bar, or the page being viewed.

function spotifyTrackUrl() {
  // The bar links the title to its album, with the track in ?highlight=spotify:track:<id>.
  const link = document.querySelector('[data-testid="context-item-info-title"] a, [data-testid="context-item-link"]');
  const href = link ? absoluteUrl(link.getAttribute("href")) : null;
  if (href) {
    const url = new URL(href);
    const highlighted = /spotify:track:([A-Za-z0-9]+)/.exec(url.searchParams.get("highlight") || "");
    if (highlighted) return `https://open.spotify.com/track/${highlighted[1]}`;
    if (/\/track\//.test(url.pathname)) return url.origin + url.pathname;
  }
  return null;
}

function getSpotifyTrack() {
  const session = mediaSessionTrack();
  const title = (session && session.title) || textOf('[data-testid="context-item-info-title"]');
  const artist = (session && session.artist) || textOf('[data-testid="context-item-info-subtitles"]');
  const coverEl =
    document.querySelector('[data-testid="CoverSlotCollapsed--container"] img') || document.querySelector(".cover-art img");
  const cover = (session && session.cover) || (coverEl && coverEl.src);

  const trackUrl = spotifyTrackUrl();
  if (title && trackUrl) return { title, artist, cover, url: trackUrl, kind: "track" };

  // Nothing playing: share the album or playlist page that is open.
  const page = /^\/(?:intl-[a-z-]+\/)?(album|playlist|track)\//.exec(location.pathname);
  if (page) {
    const pageTitle = title || textOf('[data-testid="entityTitle"]') || document.title.replace(/ \| Spotify$/, "");
    return { title: pageTitle, artist, cover, url: location.origin + location.pathname, kind: page[1] };
  }
  return title ? { title, artist, cover, url: null } : null;
}

registerTrackDetector("spotify", getSpotifyTrack, ['[data-testid="now-playing-bar"]', ".Root__now-playing-bar"]);

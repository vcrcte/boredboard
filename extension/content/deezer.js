// Deezer: the track in the player bar, or the album / playlist page being viewed.

function deezerTrackUrl() {
  const link = document.querySelector('[data-testid="item_title"] a[href*="/track/"], .track-link[href*="/track/"]');
  const href = link ? absoluteUrl(link.getAttribute("href")) : null;
  const id = href ? /\/track\/(\d+)/.exec(href) : null;
  return id ? `https://www.deezer.com/track/${id[1]}` : null;
}

function getDeezerTrack() {
  const session = mediaSessionTrack();
  const title =
    (session && session.title) || textOf('[data-testid="item_title"], .track-title, [class*="PlayerTrackTitle"]');
  const artist =
    (session && session.artist) || textOf('[data-testid="item_subtitle"], .track-artist, [class*="PlayerTrackArtist"]');
  const coverEl = document.querySelector('.track-cover img, [class*="PlayerCover"] img');
  const cover = (session && session.cover) || (coverEl && coverEl.src);

  const trackUrl = deezerTrackUrl();
  if (title && trackUrl) return { title, artist, cover, url: trackUrl, kind: "track" };

  const page = /\/(track|album|playlist)\/(\d+)/.exec(location.pathname);
  if (page) {
    const pageTitle = title || textOf("h1") || document.title.split(" - ")[0];
    return { title: pageTitle, artist, cover, url: `https://www.deezer.com/${page[1]}/${page[2]}`, kind: page[1] };
  }
  return title ? { title, artist, cover, url: null } : null;
}

registerTrackDetector("deezer", getDeezerTrack, [".player-controls", '[class*="PlayerControls"]']);

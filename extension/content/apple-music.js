// Apple Music (web): the playing track from the media session; the link is
// the song, album or playlist page being viewed, when there is one.

function getAppleMusicTrack() {
  const session = mediaSessionTrack();
  const title =
    (session && session.title) ||
    textOf(".web-chrome-playback-lcd__song-name-scroll-inner, .lcd-meta__primary, [data-testid='now-playing-title']");
  const artist =
    (session && session.artist) ||
    textOf(".web-chrome-playback-lcd__sub-copy-scroll-inner, .lcd-meta__secondary, [data-testid='now-playing-subtitle']");
  const coverEl = document.querySelector(".web-chrome-playback-lcd__artwork img");
  const cover = (session && session.cover) || (coverEl && coverEl.src);

  const page = /\/(song|album|playlist)\//.exec(location.pathname);
  const kind = page ? (page[1] === "song" ? "track" : page[1]) : "track";
  const url = page ? location.href : null;

  if (title) return { title, artist, cover, url, kind: url ? kind : "track" };
  if (page) {
    const pageTitle = textOf("h1") || document.title.replace(/ - Apple Music$/, "");
    return pageTitle ? { title: pageTitle, artist: "", cover: null, url, kind } : null;
  }
  return null;
}

registerTrackDetector("apple", getAppleMusicTrack, [".web-chrome-playback-controls", '[class*="playback-controls"]']);

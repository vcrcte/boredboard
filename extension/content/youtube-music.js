// YouTube Music: the playing video (its id is in the page URL), or the playlist being viewed.

function getYouTubeMusicTrack() {
  const session = mediaSessionTrack();
  const title = (session && session.title) || textOf("ytmusic-player-bar .title");
  // The byline reads "Artist • Album • Year": the artist is its first part.
  const artist = (session && session.artist) || textOf("ytmusic-player-bar .byline").split("•")[0].trim();
  const coverEl = document.querySelector("#song-image img, ytmusic-player-bar img");
  const cover = (session && session.cover) || (coverEl && coverEl.src);

  const params = new URLSearchParams(location.search);
  const videoId = params.get("v");
  if (title && videoId) {
    return { title, artist, cover, url: `https://music.youtube.com/watch?v=${videoId}`, kind: "track" };
  }

  const playlistId = params.get("list");
  if (playlistId && location.pathname === "/playlist") {
    const pageTitle = textOf("ytmusic-responsive-header-renderer h1, h2.title") || document.title.replace(/ - YouTube Music$/, "");
    return { title: pageTitle, artist: "", cover: null, url: `https://music.youtube.com/playlist?list=${playlistId}`, kind: "playlist" };
  }
  return title ? { title, artist, cover, url: null } : null;
}

registerTrackDetector("youtube", getYouTubeMusicTrack, [".middle-controls", "ytmusic-player-bar"]);

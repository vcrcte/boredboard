import { describe, expect, it } from "vitest";
import {
  acceptMatch,
  artistsOverlap,
  normalizeTitle,
  parseSoundCloudTitle,
  parseSpotifyPage,
  primaryService,
  searchUrl,
  type Matches,
} from "./music-match";

describe("normalizeTitle", () => {
  it.each([
    ["Never Gonna Give You Up", "never gonna give you up"],
    ["Été Indien", "ete indien"],
    ["Get Lucky (feat. Pharrell Williams)", "get lucky"],
    ["Get Lucky feat. Pharrell Williams", "get lucky"],
    ["Here Comes The Sun - Remastered 2009", "here comes the sun"],
    ["Here Comes The Sun (2019 Remaster)", "here comes the sun"],
    ["Don't Stop Me Now", "don t stop me now"],
  ])("%s → %s", (input, expected) => {
    expect(normalizeTitle(input)).toBe(expected);
  });
});

describe("artistsOverlap", () => {
  it("matches a shared artist across credit formats", () => {
    expect(artistsOverlap("Daft Punk", "Daft Punk, Pharrell Williams")).toBe(true);
    expect(artistsOverlap("Josh Gigante & KIMONOS", "KIMONOS")).toBe(true);
    expect(artistsOverlap("Stromae", "stromaé")).toBe(true);
  });
  it("rejects different artists", () => {
    expect(artistsOverlap("Rick Astley", "Rick Ross")).toBe(false);
  });
});

describe("acceptMatch", () => {
  const source = { title: "Never Gonna Give You Up", artist: "Rick Astley", duration: 214 };

  it("accepts an identical ISRC whatever the text", () => {
    expect(acceptMatch({ ...source, isrc: "GBARL9300135" }, { title: "x", artist: "y", isrc: "gbarl9300135" })).toBe("isrc");
  });

  it("accepts same title and artist within ±3 s (Spotify 214 s vs Deezer 211 s)", () => {
    expect(acceptMatch(source, { title: "Never Gonna Give You Up", artist: "Rick Astley", duration: 211 })).toBe("text+duration");
  });

  it("rejects a version 4 s longer (live, extended)", () => {
    expect(acceptMatch(source, { title: "Never Gonna Give You Up", artist: "Rick Astley", duration: 218 })).toBeNull();
  });

  it("rejects a same-title song by another artist", () => {
    expect(acceptMatch(source, { title: "Never Gonna Give You Up", artist: "Cover Band", duration: 214 })).toBeNull();
  });

  it("rejects when either duration is unknown (no guessing)", () => {
    expect(acceptMatch({ title: source.title, artist: source.artist }, { ...source })).toBeNull();
  });
});

describe("parseSpotifyPage", () => {
  const html = `<meta property="og:title" content="Never Gonna Give You Up"/>
<meta property="og:description" content="Rick Astley · Whenever You Need Somebody · Song · 1987"/>
<meta property="og:image" content="https://i.scdn.co/image/abc"/>
<meta name="music:duration" content="214"/>
<meta name="music:musician_description" content="Rick Astley"/>`;

  it("reads title, artist, duration and cover from the meta tags", () => {
    expect(parseSpotifyPage(html)).toEqual({ title: "Never Gonna Give You Up", artist: "Rick Astley", duration: 214, image: "https://i.scdn.co/image/abc" });
  });

  it("falls back to the description for the artist and decodes entities", () => {
    const page = `<meta property="og:title" content="Rock &amp; Roll"/><meta property="og:description" content="Led Zeppelin · IV · Song · 1971"/>`;
    expect(parseSpotifyPage(page)).toMatchObject({ title: "Rock & Roll", artist: "Led Zeppelin", duration: undefined });
  });

  it("returns null for a page without a title", () => {
    expect(parseSpotifyPage("<html></html>")).toBeNull();
  });
});

describe("parseSoundCloudTitle", () => {
  it('splits "Track by Uploader"', () => {
    expect(parseSoundCloudTitle("Flickermood by Forss", "Forss")).toEqual({ title: "Flickermood", artist: "Forss" });
  });
  it("keeps the whole title when it doesn't end with the uploader", () => {
    expect(parseSoundCloudTitle("Live at Fabric", "dj-someone")).toEqual({ title: "Live at Fabric", artist: "dj-someone" });
  });
});

describe("searchUrl", () => {
  it("builds an encoded search per service", () => {
    expect(searchUrl("deezer", { title: "Été Indien", artist: "Joe Dassin" })).toBe("https://www.deezer.com/search/Joe%20Dassin%20%C3%89t%C3%A9%20Indien");
    expect(searchUrl("youtube", { title: "A&B", artist: "X" })).toBe("https://www.youtube.com/results?search_query=X%20A%26B");
  });
});

describe("primaryService", () => {
  const matches: Matches = {
    spotify: { url: "https://open.spotify.com/track/1", method: "source" },
    deezer: { url: "https://www.deezer.com/track/2", method: "isrc" },
  };
  it("uses the shared link's service on a first visit", () => {
    expect(primaryService("spotify", null, matches)).toBe("spotify");
  });
  it("uses the remembered service when it has a link", () => {
    expect(primaryService("spotify", "deezer", matches)).toBe("deezer");
  });
  it("ignores an unknown or unavailable remembered value", () => {
    expect(primaryService("spotify", "tidal", matches)).toBe("spotify");
    expect(primaryService("spotify", "apple", matches)).toBe("spotify");
  });
});

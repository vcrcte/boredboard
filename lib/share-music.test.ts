import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { extractLink, shareMusicLink } from "./share-music";

describe("extractLink", () => {
  it("keeps only the link from shared text", () => {
    expect(extractLink("Écoute Feel So Right sur Spotify https://open.spotify.com/track/abc?si=1 ")).toBe("https://open.spotify.com/track/abc?si=1");
  });
  it("returns null without an https link", () => {
    expect(extractLink("pas de lien")).toBeNull();
    expect(extractLink(42)).toBeNull();
  });
});

function fakeDb(row: { id: string } | null) {
  const insert = vi.fn(() => ({ select: () => ({ single: async () => ({ data: row, error: row ? null : { message: "refusé" } }) }) }));
  return { db: { from: () => ({ insert }) } as unknown as SupabaseClient, insert };
}

describe("shareMusicLink", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("posts the resolved track and returns its /s/ link", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ platform: "spotify", title: "Feel So Right — KIMONOS", embed_url: "https://open.spotify.com/embed/track/abc" }))));
    const { db, insert } = fakeDb({ id: "post-1" });
    const result = await shareMusicLink(db, "user-1", "https://open.spotify.com/track/abc", "https://bb.test");
    expect(result).toEqual({ ok: true, shareUrl: "https://bb.test/s/post-1", title: "Feel So Right — KIMONOS" });
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ user_id: "user-1", type: "musique", url: "https://open.spotify.com/track/abc" }));
  });

  it("refuses a link the embed route doesn't recognise, without posting", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 400 })));
    const { db, insert } = fakeDb({ id: "post-1" });
    const result = await shareMusicLink(db, "user-1", "https://example.com/x", "https://bb.test");
    expect(result).toMatchObject({ ok: false, status: 400 });
    expect(insert).not.toHaveBeenCalled();
  });

  it("refuses text without a link", async () => {
    const { db } = fakeDb(null);
    expect(await shareMusicLink(db, "user-1", "rien", "https://bb.test")).toMatchObject({ ok: false, status: 400 });
  });
});

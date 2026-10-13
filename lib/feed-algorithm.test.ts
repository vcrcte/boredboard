import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildSignals, diversify, scorePost, type ScoredPost, type UserSignals } from "./feed-algorithm";

const NOW = new Date("2026-10-13T12:00:00Z");
const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();

const noSignals: UserSignals = {
  followingIds: new Set(),
  categoryAffinity: {},
  typeAffinity: {},
  authorAffinity: {},
  interests: [],
};

const post = (over: Partial<Parameters<typeof scorePost>[0]> = {}) => ({
  id: "p1",
  user_id: "author",
  type: "musique",
  category: null,
  likes_count: 0,
  created_at: hoursAgo(1),
  ...over,
});

const scored = (id: string, over: Partial<ScoredPost> = {}): ScoredPost => ({
  id,
  user_id: "author",
  type: "musique",
  content: "",
  url: null,
  category: null,
  likes_count: 0,
  created_at: hoursAgo(1),
  profiles: { id: "author", name: null, username: "author", avatar_url: null },
  _score: 1,
  ...over,
});

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("scorePost", () => {
  it("scores 0 when the viewer has no signals and the post has no likes", () => {
    expect(scorePost(post(), noSignals)).toBe(0);
  });

  it("ranks a followed author above an unknown one", () => {
    const signals = { ...noSignals, followingIds: new Set(["friend"]) };
    expect(scorePost(post({ user_id: "friend" }), signals)).toBeGreaterThan(scorePost(post(), signals));
  });

  it("raises the score with likes, on a log scale", () => {
    const none = scorePost(post({ likes_count: 0 }), noSignals);
    const one = scorePost(post({ likes_count: 1 }), noSignals);
    const many = scorePost(post({ likes_count: 100 }), noSignals);
    expect(one).toBeGreaterThan(none);
    expect(many).toBeGreaterThan(one);
    expect(many).toBeLessThan(one * 100);
  });

  it("ranks a fresher post above an older one with the same signals", () => {
    const signals = { ...noSignals, followingIds: new Set(["friend"]) };
    const fresh = scorePost(post({ user_id: "friend", created_at: hoursAgo(1) }), signals);
    const old = scorePost(post({ user_id: "friend", created_at: hoursAgo(72) }), signals);
    expect(fresh).toBeGreaterThan(old);
  });

  it("treats a negative likes count as 0", () => {
    expect(scorePost(post({ likes_count: -5 }), noSignals)).toBe(0);
  });
});

describe("diversify", () => {
  it("returns a list of 0 or 1 post unchanged", () => {
    expect(diversify([])).toEqual([]);
    const single = [scored("a")];
    expect(diversify(single)).toBe(single);
  });

  it("moves a different type ahead of a repeat when scores are close", () => {
    const posts = [
      scored("music-1", { type: "musique", _score: 10 }),
      scored("music-2", { type: "musique", _score: 9 }),
      scored("article", { type: "article", _score: 8.5 }),
    ];
    expect(diversify(posts).map((p) => p.id)).toEqual(["music-1", "article", "music-2"]);
  });

  it("keeps every post", () => {
    const posts = Array.from({ length: 15 }, (_, i) => scored(`p${i}`, { _score: 15 - i }));
    expect(diversify(posts)).toHaveLength(15);
  });
});

describe("buildSignals", () => {
  it("counts affinities and skips interactions whose post is missing", () => {
    const signals = buildSignals(
      [
        { post_id: "1", type: "like", posts: { user_id: "a", type: "musique", category: "Art" } },
        { post_id: "2", type: "like", posts: { user_id: "a", type: "musique", category: null } },
        { post_id: "3", type: "like", posts: null },
      ],
      ["f"],
      ["Art"],
    );
    expect(signals.authorAffinity).toEqual({ a: 2 });
    expect(signals.typeAffinity).toEqual({ musique: 2 });
    expect(signals.categoryAffinity).toEqual({ Art: 1 });
    expect(signals.followingIds.has("f")).toBe(true);
  });
});

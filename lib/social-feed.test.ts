import { describe, expect, it } from "vitest";
import { bookProgress, bookVerb, buildStats, likersLine, mergeEntries, postVerb, type FeedEntry, type InteractionRow, type Person } from "./social-feed";

const lea: Person = { id: "lea", name: "Léa", username: "lea" };
const sam: Person = { id: "sam", name: null, username: "sam" };
const me: Person = { id: "me", name: "Victor", username: "victor" };

const row = (over: Partial<InteractionRow>): InteractionRow => ({
  id: Math.random().toString(36),
  post_id: "p1",
  user_id: "lea",
  type: "like",
  content: null,
  created_at: "2026-10-15T10:00:00Z",
  profiles: lea,
  ...over,
});

describe("buildStats", () => {
  it("counts likes, lists likers and keeps comments oldest first", () => {
    const stats = buildStats(
      [
        row({ type: "comment", content: "  trop bien  ", created_at: "2026-10-15T12:00:00Z" }),
        row({ type: "like" }),
        row({ type: "comment", content: "ah oui", user_id: "sam", profiles: [sam], created_at: "2026-10-15T11:00:00Z" }),
        row({ type: "comment", content: "   " }),
        row({ type: "reaction", content: "🔥" }),
        row({ post_id: "other" }),
      ],
      ["p1", "p2"],
    );
    expect(stats.p1.likes).toBe(1);
    expect(stats.p1.likers).toEqual([lea]);
    expect(stats.p1.comments.map((c) => [c.author.username, c.text])).toEqual([
      ["sam", "ah oui"],
      ["lea", "trop bien"],
    ]);
    expect(stats.p2).toEqual({ likes: 0, likers: [], comments: [] });
    expect(stats.other).toBeUndefined();
  });
});

describe("likersLine", () => {
  it("is null with no likes", () => expect(likersLine([], "me")).toBeNull());
  it("names one or two people", () => {
    expect(likersLine([lea], "me")).toBe("Aimé par Léa");
    expect(likersLine([lea, sam], "me")).toBe("Aimé par Léa et sam");
  });
  it("puts the viewer first as « toi »", () => expect(likersLine([lea, me], "me")).toBe("Aimé par toi et Léa"));
  it("summarises the rest", () => {
    expect(likersLine([lea, sam, me], "me")).toBe("Aimé par toi, Léa et 1 autre");
    expect(likersLine([lea, sam, me, { id: "x", name: "X", username: "x" }], null)).toBe("Aimé par Léa, sam et 2 autres");
  });
});

describe("verbs and progress", () => {
  it("describes posts and books", () => {
    expect(postVerb("musique")).toBe("écoute");
    expect(postVerb("article")).toBe("partage un article");
    expect(bookVerb({ status: "lu" })).toBe("a fini");
    expect(bookVerb({ status: "en_cours" })).toBe("lit");
    expect(bookVerb({ status: "liste" })).toBe("veut lire");
  });
  it("shows progress only for a book in progress with pages", () => {
    expect(bookProgress({ status: "en_cours", page_current: 120, page_total: 300 })).toBe("p. 120 / 300 (40 %)");
    expect(bookProgress({ status: "en_cours", page_current: 0, page_total: 300 })).toBeNull();
    expect(bookProgress({ status: "lu", page_current: 300, page_total: 300 })).toBeNull();
  });
});

describe("mergeEntries", () => {
  const post = (id: string, at: string): FeedEntry => ({ kind: "post", id, created_at: at, post: null, stats: { likes: 0, likers: [], comments: [] } });
  const book = (id: string, at: string): FeedEntry => ({
    kind: "book",
    id,
    created_at: at,
    person: lea,
    book: { id, title: id, author: null, cover_url: null, status: "en_cours", page_current: null, page_total: null },
  });

  it("following: everything newest first", () => {
    const merged = mergeEntries([post("a", "2026-10-15T09:00Z"), post("b", "2026-10-13T09:00Z")], [book("x", "2026-10-14T09:00Z")], "following");
    expect(merged.map((e) => e.id)).toEqual(["a", "x", "b"]);
  });

  it("discover: keeps the ranked post order and slots a book every 3 posts", () => {
    const posts = ["p1", "p2", "p3", "p4"].map((id) => post(id, "2026-10-01T00:00Z"));
    const merged = mergeEntries(posts, [book("old", "2026-10-02T00:00Z"), book("new", "2026-10-14T00:00Z")], "all");
    expect(merged.map((e) => e.id)).toEqual(["p1", "p2", "p3", "new", "p4", "old"]);
  });
});

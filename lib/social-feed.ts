// The social feed: what the people you follow listen to, read and share,
// with who liked and commented. Pure helpers (unit-tested); the data is loaded
// by app/api/social-feed/route.ts and rendered by components/feed/.

export type FeedScope = "following" | "all";

export type Person = { id: string; name: string | null; username: string };

export type FeedComment = { id: string; author: Person; text: string; created_at: string };

export type PostStats = { likes: number; likers: Person[]; comments: FeedComment[] };

export type BookActivity = {
  id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  status: "en_cours" | "lu" | "liste";
  page_current: number | null;
  page_total: number | null;
};

/** One line of the feed: a post (with its social stats) or a change on someone's reading list. */
export type FeedEntry<P = unknown> =
  | { kind: "post"; id: string; created_at: string; post: P; stats: PostStats }
  | { kind: "book"; id: string; created_at: string; person: Person; book: BookActivity };

export type InteractionRow = {
  id: string;
  post_id: string;
  user_id: string;
  type: string;
  content: string | null;
  created_at: string;
  profiles: Person | Person[] | null;
};

export const displayName = (person: Pick<Person, "name" | "username"> | null | undefined) => person?.name || person?.username || "Quelqu'un";

const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? (value[0] ?? null) : value);

/** Likes and comments per post from raw interaction rows (oldest comment first). */
export function buildStats(rows: InteractionRow[], postIds: string[]): Record<string, PostStats> {
  const stats: Record<string, PostStats> = {};
  for (const id of postIds) stats[id] = { likes: 0, likers: [], comments: [] };
  const sorted = [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  for (const row of sorted) {
    const entry = stats[row.post_id];
    if (!entry) continue;
    const author = one(row.profiles) ?? { id: row.user_id, name: null, username: "" };
    if (row.type === "like") {
      entry.likes += 1;
      entry.likers.push(author);
    } else if (row.type === "comment" && row.content?.trim()) {
      entry.comments.push({ id: row.id, author, text: row.content.trim(), created_at: row.created_at });
    }
  }
  return stats;
}

/** "Aimé par Léa", "Aimé par toi et Léa", "Aimé par Léa, Sam et 3 autres". null when nobody liked it. */
export function likersLine(likers: Person[], viewerId: string | null): string | null {
  if (likers.length === 0) return null;
  const others = likers.filter((p) => p.id !== viewerId);
  const names = [...(others.length < likers.length ? ["toi"] : []), ...others.map(displayName)];
  if (names.length === 1) return `Aimé par ${names[0]}`;
  if (names.length === 2) return `Aimé par ${names[0]} et ${names[1]}`;
  const rest = names.length - 2;
  return `Aimé par ${names[0]}, ${names[1]} et ${rest} autre${rest > 1 ? "s" : ""}`;
}

/** The verb after a person's name: "Léa écoute", "Léa lit", "Léa partage un article". */
export function postVerb(type: string): string {
  switch (type) {
    case "musique":
      return "écoute";
    case "livre":
      return "lit";
    case "article":
      return "partage un article";
    case "reflexion":
      return "partage une réflexion";
    default:
      return "partage";
  }
}

export function bookVerb(book: Pick<BookActivity, "status">): string {
  return book.status === "lu" ? "a fini" : book.status === "en_cours" ? "lit" : "veut lire";
}

/** "p. 120 / 300 (40 %)" for a book in progress with known pages, else null. */
export function bookProgress(book: Pick<BookActivity, "status" | "page_current" | "page_total">): string | null {
  if (book.status !== "en_cours" || !book.page_total || !book.page_current) return null;
  const pct = Math.min(100, Math.round((book.page_current / book.page_total) * 100));
  return `p. ${book.page_current} / ${book.page_total} (${pct} %)`;
}

/**
 * Following feed: everything newest first. Discover feed: posts keep the
 * ranking from lib/feed-algorithm and reading activity is slotted in every
 * `every` entries, newest first, so books don't drown the shares.
 */
export function mergeEntries<P>(posts: FeedEntry<P>[], books: FeedEntry<P>[], scope: FeedScope, every = 3): FeedEntry<P>[] {
  if (scope === "following") return [...posts, ...books].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const queue = [...books].sort((a, b) => b.created_at.localeCompare(a.created_at));
  const out: FeedEntry<P>[] = [];
  posts.forEach((entry, i) => {
    out.push(entry);
    if ((i + 1) % every === 0 && queue.length) out.push(queue.shift()!);
  });
  return [...out, ...queue];
}

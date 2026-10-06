import { supabase } from "@/lib/supabase";

export type BookStatus = "en_cours" | "lu" | "liste";

export type Book = {
  id: string;
  user_id: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  status: BookStatus;
  page_current: number | null;
  page_total: number | null;
  created_at: string;
};

export type BookWithProfile = Book & {
  profiles: {
    id: string;
    name: string | null;
    username: string;
  } | null;
};

/** Open Library search result. */
export type OLBook = {
  key: string;
  title: string;
  author: string | null;
  cover_url: string | null;
  pages: number | null;
  year: number | null;
};

const BOOK_SELECT = "id, user_id, title, author, cover_url, status, page_current, page_total, created_at";

// ── CRUD ────────────────────────────────────────────────────────────────

/** Fetch all books for a user, ordered by status then recency. */
export async function getUserBooks(userId: string): Promise<Book[]> {
  const { data } = await supabase
    .from("books")
    .select(BOOK_SELECT)
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return (data ?? []).map(normalizeBook);
}

/** Fetch books for multiple users (followed users' reading). */
export async function getNetworkBooks(userIds: string[], status?: BookStatus): Promise<BookWithProfile[]> {
  if (!userIds.length) return [];
  let query = supabase
    .from("books")
    .select(`${BOOK_SELECT}, profiles (id, name, username)`)
    .in("user_id", userIds)
    .order("created_at", { ascending: false })
    .limit(20);
  if (status) query = query.eq("status", status);
  const { data } = await query;
  return (data ?? []).map((row) => ({
    ...normalizeBook(row),
    profiles: row.profiles as BookWithProfile["profiles"],
  }));
}

/** Add a book to the user's reading list. */
export async function addBook(
  userId: string,
  book: { title: string; author?: string; cover_url?: string; page_total?: number; status?: BookStatus },
): Promise<Book | null> {
  const { data, error } = await supabase
    .from("books")
    .insert({
      user_id: userId,
      title: book.title,
      author: book.author ?? null,
      cover_url: book.cover_url ?? null,
      page_total: book.page_total ?? null,
      status: book.status ?? "liste",
      page_current: 0,
    })
    .select(BOOK_SELECT)
    .single();
  if (error) {
    // If cover_url column doesn't exist yet, retry without it
    if (/cover_url/i.test(error.message)) {
      const { data: fallback } = await supabase
        .from("books")
        .insert({
          user_id: userId,
          title: book.title,
          author: book.author ?? null,
          page_total: book.page_total ?? null,
          status: book.status ?? "liste",
          page_current: 0,
        })
        .select("id, user_id, title, author, status, page_current, page_total, created_at")
        .single();
      return fallback ? { ...normalizeBook(fallback), cover_url: null } : null;
    }
    return null;
  }
  return normalizeBook(data);
}

/** Update a book's status or progress. */
export async function updateBook(
  bookId: string,
  updates: { status?: BookStatus; page_current?: number; page_total?: number },
): Promise<boolean> {
  const { error } = await supabase.from("books").update(updates).eq("id", bookId);
  return !error;
}

/** Delete a book from the list. */
export async function deleteBook(bookId: string): Promise<boolean> {
  const { error } = await supabase.from("books").delete().eq("id", bookId);
  return !error;
}

// ── Open Library search ─────────────────────────────────────────────────

/** Search Open Library for books by title or author. */
export async function searchOpenLibrary(query: string, limit = 8): Promise<OLBook[]> {
  const q = encodeURIComponent(query.trim());
  if (!q) return [];
  try {
    const res = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=${limit}&fields=key,title,author_name,cover_i,number_of_pages_median,first_publish_year`);
    if (!res.ok) return [];
    const json = await res.json();
    return (json.docs ?? []).map((doc: Record<string, unknown>) => ({
      key: doc.key as string,
      title: doc.title as string,
      author: Array.isArray(doc.author_name) ? (doc.author_name as string[])[0] : null,
      cover_url: doc.cover_i ? `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg` : null,
      pages: (doc.number_of_pages_median as number) ?? null,
      year: (doc.first_publish_year as number) ?? null,
    }));
  } catch {
    return [];
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────

export function statusLabel(status: BookStatus): string {
  return status === "en_cours" ? "En cours" : status === "lu" ? "Terminé" : "À lire";
}

export function statusColor(status: BookStatus): { bg: string; text: string } {
  return status === "en_cours"
    ? { bg: "rgba(196,169,74,0.12)", text: "#8B6914" }
    : status === "lu"
      ? { bg: "rgba(22,163,74,0.1)", text: "#16A34A" }
      : { bg: "rgba(28,26,21,0.06)", text: "rgba(28,26,21,0.45)" };
}

export function progressPercent(book: Book): number | null {
  if (!book.page_current || !book.page_total || book.page_total === 0) return null;
  return Math.min(100, Math.round((book.page_current / book.page_total) * 100));
}

function normalizeBook(raw: Record<string, unknown>): Book {
  return {
    id: raw.id as string,
    user_id: raw.user_id as string,
    title: raw.title as string,
    author: (raw.author as string | null) ?? null,
    cover_url: (raw.cover_url as string | null) ?? null,
    status: (raw.status as BookStatus) ?? "liste",
    page_current: (raw.page_current as number | null) ?? null,
    page_total: (raw.page_total as number | null) ?? null,
    created_at: raw.created_at as string,
  };
}

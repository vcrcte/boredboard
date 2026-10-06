"use client";

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import Navbar, { getInitials } from "@/components/Navbar";
import {
  addBook,
  deleteBook,
  getNetworkBooks,
  getUserBooks,
  progressPercent,
  searchOpenLibrary,
  statusColor,
  statusLabel,
  updateBook,
  type Book,
  type BookStatus,
  type BookWithProfile,
  type OLBook,
} from "@/lib/books";
import { avatarTones } from "@/lib/sample-data";
import { supabase } from "@/lib/supabase";

const CREAM = "#F7F4EE";
const INDIGO = "#2A3560";
const TEXT = "#1C1A15";
const WHITE = "#FFFFFF";
const GEORGIA = "Georgia, 'Times New Roman', serif";
const ink = (a: number) => `rgba(28,26,21,${a})`;
const black = (a: number) => `rgba(0,0,0,${a})`;
const DIM = ink(0.4);
const GREEN = "#16A34A";
const RED = "#C0392B";

const card: CSSProperties = { background: WHITE, border: `1px solid ${black(0.07)}`, borderRadius: 14, padding: 16 };

const statusTabs: { value: BookStatus | "all"; label: string }[] = [
  { value: "all", label: "Tous" },
  { value: "en_cours", label: "En cours" },
  { value: "lu", label: "Terminés" },
  { value: "liste", label: "À lire" },
];

function BookCover({ url, title, size = 56 }: { url: string | null; title: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const spineColors = ["#EEEDFE", "#E1F5EE", "#FAEEDA", "#FDE8E8", "#E8F4FD"];
  const bg = spineColors[title.charCodeAt(0) % spineColors.length];

  if (url && !failed) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={title}
        loading="lazy"
        onError={() => setFailed(true)}
        className="shrink-0"
        style={{ width: size, height: size * 1.4, objectFit: "cover", borderRadius: 6, background: bg }}
      />
    );
  }

  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{ width: size, height: size * 1.4, background: bg, borderRadius: 6, fontSize: size * 0.35 }}
      aria-hidden
    >
      📖
    </span>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <span className="block overflow-hidden" style={{ height: 4, background: black(0.06), borderRadius: 2, width: "100%" }}>
      <span style={{ display: "block", height: "100%", width: `${percent}%`, background: "#C4A94A", borderRadius: 2, transition: "width 0.3s" }} />
    </span>
  );
}

// ── Add Book Modal ──────────────────────────────────────────────────────

function AddBookModal({ userId, onClose, onAdded }: { userId: string; onClose: () => void; onAdded: () => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<OLBook[]>([]);
  const [searching, setSearching] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [pages, setPages] = useState("");
  const [status, setStatus] = useState<BookStatus>("liste");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim() || manualMode) { setResults([]); return; }
    setSearching(true);
    const timeout = setTimeout(async () => {
      const books = await searchOpenLibrary(query);
      setResults(books);
      setSearching(false);
    }, 400);
    return () => clearTimeout(timeout);
  }, [query, manualMode]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const selectBook = async (book: OLBook) => {
    setSubmitting(true);
    const result = await addBook(userId, {
      title: book.title,
      author: book.author ?? undefined,
      cover_url: book.cover_url ?? undefined,
      page_total: book.pages ?? undefined,
      status,
    });
    if (result) { onAdded(); onClose(); }
    else { setError("Impossible d'ajouter ce livre."); setSubmitting(false); }
  };

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    const result = await addBook(userId, {
      title: title.trim(),
      author: author.trim() || undefined,
      page_total: pages ? parseInt(pages) : undefined,
      status,
    });
    if (result) { onAdded(); onClose(); }
    else { setError("Impossible d'ajouter ce livre."); setSubmitting(false); }
  };

  const field: CSSProperties = {
    background: CREAM,
    border: `1px solid ${black(0.08)}`,
    borderRadius: 10,
    color: TEXT,
    outline: "none",
    width: "100%",
    padding: "10px 14px",
    fontSize: 13,
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center px-5"
      style={{ background: black(0.4), backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-book-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full"
        style={{ maxWidth: 480, maxHeight: "85vh", background: WHITE, borderRadius: 20, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflowY: "auto" }}
      >
        <div className="flex items-center">
          <h2 id="add-book-title" style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>
            {manualMode ? "Ajouter manuellement" : "Ajouter un livre"}
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="ml-auto" style={{ fontSize: 16, color: DIM }}>
            ✕
          </button>
        </div>

        {/* Status selector */}
        <div className="mt-3 flex flex-wrap" style={{ gap: 6 }}>
          {(["liste", "en_cours", "lu"] as BookStatus[]).map((s) => {
            const sc = statusColor(s);
            const on = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                style={{
                  fontSize: 12, padding: "5px 14px", borderRadius: 20, transition: "background-color 0.15s",
                  ...(on ? { background: sc.bg, color: sc.text, fontWeight: 500 } : { background: black(0.04), color: ink(0.5) }),
                }}
              >
                {statusLabel(s)}
              </button>
            );
          })}
        </div>

        {!manualMode ? (
          <>
            {/* Search input */}
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Chercher un titre ou un auteur..."
              autoFocus
              className="mt-4"
              style={field}
            />

            {/* Search results */}
            {searching && <p className="mt-3" style={{ fontSize: 12, color: DIM }}>Recherche en cours...</p>}
            {results.length > 0 && (
              <div className="mt-3 flex flex-col" style={{ gap: 8 }}>
                {results.map((book) => (
                  <button
                    key={book.key}
                    type="button"
                    onClick={() => selectBook(book)}
                    disabled={submitting}
                    className="flex items-center text-left transition hover:bg-black/[0.03] disabled:opacity-50"
                    style={{ gap: 12, padding: 8, borderRadius: 10 }}
                  >
                    <BookCover url={book.cover_url} title={book.title} size={36} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate" style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{book.title}</span>
                      <span className="block truncate" style={{ fontSize: 11, color: DIM }}>
                        {[book.author, book.year].filter(Boolean).join(" · ")}
                        {book.pages && ` · ${book.pages} p.`}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
            {query.trim() && !searching && results.length === 0 && (
              <p className="mt-3 text-center" style={{ fontSize: 12, color: DIM }}>
                Aucun résultat pour « {query} »
              </p>
            )}

            <button
              type="button"
              onClick={() => setManualMode(true)}
              className="mt-4 w-full"
              style={{ fontSize: 12, color: INDIGO, fontWeight: 500 }}
            >
              + Ajouter manuellement
            </button>
          </>
        ) : (
          <form onSubmit={handleManualSubmit} className="mt-4 flex flex-col" style={{ gap: 12 }}>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre du livre *" required style={field} />
            <input value={author} onChange={(e) => setAuthor(e.target.value)} placeholder="Auteur" style={field} />
            <input value={pages} onChange={(e) => setPages(e.target.value.replace(/\D/g, ""))} placeholder="Nombre de pages" inputMode="numeric" style={field} />
            <button
              type="submit"
              disabled={!title.trim() || submitting}
              className="w-full transition hover:brightness-110 disabled:opacity-50"
              style={{ background: INDIGO, color: CREAM, borderRadius: 20, padding: "11px 24px", fontSize: 13, fontWeight: 500 }}
            >
              {submitting ? "Ajout..." : "Ajouter"}
            </button>
            <button type="button" onClick={() => setManualMode(false)} style={{ fontSize: 12, color: DIM }}>
              ← Retour à la recherche
            </button>
          </form>
        )}

        {error && <p role="alert" className="mt-3 text-center" style={{ fontSize: 12, color: RED }}>{error}</p>}
      </div>
    </div>
  );
}

// ── Edit Book Modal ─────────────────────────────────────────────────────

function EditBookModal({ book, onClose, onUpdated, onDeleted }: { book: Book; onClose: () => void; onUpdated: () => void; onDeleted: () => void }) {
  const [status, setStatus] = useState<BookStatus>(book.status);
  const [pageCurrent, setPageCurrent] = useState(String(book.page_current ?? ""));
  const [pageTotal, setPageTotal] = useState(String(book.page_total ?? ""));
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSave = async () => {
    setSaving(true);
    const ok = await updateBook(book.id, {
      status,
      page_current: pageCurrent ? parseInt(pageCurrent) : undefined,
      page_total: pageTotal ? parseInt(pageTotal) : undefined,
    });
    if (ok) onUpdated();
    setSaving(false);
    onClose();
  };

  const handleDelete = async () => {
    setDeleting(true);
    const ok = await deleteBook(book.id);
    if (ok) onDeleted();
    setDeleting(false);
    onClose();
  };

  const field: CSSProperties = {
    background: CREAM, border: `1px solid ${black(0.08)}`, borderRadius: 10,
    color: TEXT, outline: "none", width: "100%", padding: "10px 14px", fontSize: 13,
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center px-5"
      style={{ background: black(0.4), backdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className="w-full"
        style={{ maxWidth: 400, background: WHITE, borderRadius: 20, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
      >
        <div className="flex items-start gap-3">
          <BookCover url={book.cover_url} title={book.title} size={48} />
          <div className="min-w-0 flex-1">
            <p style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>{book.title}</p>
            {book.author && <p style={{ fontSize: 12, color: DIM }}>{book.author}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fermer" style={{ fontSize: 16, color: DIM }}>✕</button>
        </div>

        {/* Status */}
        <p className="mb-2 mt-4" style={{ fontSize: 11, color: DIM }}>Statut</p>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {(["liste", "en_cours", "lu"] as BookStatus[]).map((s) => {
            const sc = statusColor(s);
            const on = status === s;
            return (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                style={{
                  fontSize: 12, padding: "5px 14px", borderRadius: 20,
                  ...(on ? { background: sc.bg, color: sc.text, fontWeight: 500 } : { background: black(0.04), color: ink(0.5) }),
                }}
              >
                {statusLabel(s)}
              </button>
            );
          })}
        </div>

        {/* Page progress */}
        <p className="mb-2 mt-4" style={{ fontSize: 11, color: DIM }}>Progression</p>
        <div className="flex items-center" style={{ gap: 8 }}>
          <input
            value={pageCurrent}
            onChange={(e) => setPageCurrent(e.target.value.replace(/\D/g, ""))}
            placeholder="Page actuelle"
            inputMode="numeric"
            style={{ ...field, width: "auto", flex: 1 }}
          />
          <span style={{ fontSize: 13, color: DIM }}>/</span>
          <input
            value={pageTotal}
            onChange={(e) => setPageTotal(e.target.value.replace(/\D/g, ""))}
            placeholder="Total"
            inputMode="numeric"
            style={{ ...field, width: "auto", flex: 1 }}
          />
        </div>
        {pageCurrent && pageTotal && parseInt(pageTotal) > 0 && (
          <div className="mt-2">
            <ProgressBar percent={Math.min(100, Math.round((parseInt(pageCurrent) / parseInt(pageTotal)) * 100))} />
            <p className="mt-1 text-right" style={{ fontSize: 10, color: DIM }}>
              {Math.min(100, Math.round((parseInt(pageCurrent) / parseInt(pageTotal)) * 100))}%
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-4 flex items-center gap-3">
          {confirmDelete ? (
            <>
              <span style={{ fontSize: 12, color: RED }}>Supprimer ce livre ?</span>
              <button type="button" onClick={handleDelete} disabled={deleting} style={{ fontSize: 12, color: RED, fontWeight: 500 }}>
                {deleting ? "..." : "Oui"}
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} style={{ fontSize: 12, color: DIM }}>Non</button>
            </>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} style={{ fontSize: 12, color: RED }}>
              Supprimer
            </button>
          )}
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="ml-auto transition hover:brightness-110 disabled:opacity-50"
            style={{ background: INDIGO, color: CREAM, borderRadius: 20, padding: "9px 20px", fontSize: 13, fontWeight: 500 }}
          >
            {saving ? "..." : "Enregistrer"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Network Reading Card ────────────────────────────────────────────────

function NetworkBookCard({ book }: { book: BookWithProfile }) {
  const tone = avatarTones[(book.user_id.charCodeAt(0) + book.user_id.charCodeAt(1)) % avatarTones.length];
  const profile = book.profiles;
  const percent = progressPercent(book);

  return (
    <div style={card} className="flex items-start gap-3">
      <BookCover url={book.cover_url} title={book.title} size={44} />
      <div className="min-w-0 flex-1">
        <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{book.title}</p>
        {book.author && <p className="truncate" style={{ fontSize: 11, color: DIM }}>{book.author}</p>}
        {percent !== null && (
          <div className="mt-1.5">
            <ProgressBar percent={percent} />
            <p className="mt-0.5" style={{ fontSize: 10, color: DIM }}>{percent}%</p>
          </div>
        )}
        <Link href={`/profile?id=${book.user_id}`} className="mt-1.5 flex items-center hover:underline" style={{ gap: 5 }}>
          <span
            className="flex items-center justify-center"
            style={{ width: 18, height: 18, borderRadius: "50%", fontSize: 7, fontWeight: 500, ...tone }}
          >
            {getInitials(profile?.name ?? null, profile?.username)}
          </span>
          <span style={{ fontSize: 11, color: ink(0.5) }}>{profile?.name ?? profile?.username}</span>
        </Link>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────

export default function Livres() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [books, setBooks] = useState<Book[] | null>(null);
  const [networkBooks, setNetworkBooks] = useState<BookWithProfile[] | null>(null);
  const [tab, setTab] = useState<BookStatus | "all">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<Book | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setSession(data.session);
    });
  }, [router]);

  const userId = session?.user.id;

  const reload = useCallback(async () => {
    if (!userId) return;
    const list = await getUserBooks(userId);
    setBooks(list);
  }, [userId]);

  // Load user's books
  useEffect(() => { reload(); }, [reload]);

  // Load network books (people they follow)
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
      const ids = (follows ?? []).map((f) => f.following_id as string);
      if (ids.length > 0) {
        const net = await getNetworkBooks(ids, "en_cours");
        if (!cancelled) setNetworkBooks(net);
      } else {
        if (!cancelled) setNetworkBooks([]);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  if (!session) return <div className="min-h-screen" style={{ background: CREAM }} />;

  const filtered = books
    ? tab === "all"
      ? books
      : books.filter((b) => b.status === tab)
    : null;

  const stats = books
    ? {
        total: books.length,
        en_cours: books.filter((b) => b.status === "en_cours").length,
        lu: books.filter((b) => b.status === "lu").length,
        liste: books.filter((b) => b.status === "liste").length,
      }
    : null;

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <Navbar />

      <main className="mx-auto px-4 sm:px-6" style={{ maxWidth: 800, paddingBlock: 32 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 style={{ fontFamily: GEORGIA, fontSize: 28, fontWeight: 400, color: TEXT }}>Mes livres</h1>
            <p className="mt-1" style={{ fontSize: 13, color: DIM }}>Ta bibliothèque personnelle</p>
          </div>
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="shrink-0 transition hover:brightness-110"
            style={{ background: INDIGO, color: CREAM, borderRadius: 20, padding: "9px 20px", fontSize: 13, fontWeight: 500 }}
          >
            + Ajouter
          </button>
        </div>

        {/* Stats */}
        {stats && stats.total > 0 && (
          <div className="mt-5 grid grid-cols-4" style={{ gap: 8 }}>
            {[
              { label: "Total", value: stats.total, icon: "📚" },
              { label: "En cours", value: stats.en_cours, icon: "📖" },
              { label: "Terminés", value: stats.lu, icon: "✅" },
              { label: "À lire", value: stats.liste, icon: "📋" },
            ].map((s) => (
              <div key={s.label} className="text-center" style={{ background: WHITE, border: `1px solid ${black(0.07)}`, borderRadius: 12, padding: "12px 8px" }}>
                <p style={{ fontSize: 14 }} aria-hidden>{s.icon}</p>
                <p style={{ fontSize: 18, fontWeight: 600, color: TEXT, lineHeight: 1.2 }}>{s.value}</p>
                <p style={{ fontSize: 10, color: DIM }}>{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* Tabs */}
        <div className="mt-6 flex" style={{ gap: 6 }}>
          {statusTabs.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              aria-pressed={tab === t.value}
              style={{
                fontSize: 12, padding: "6px 16px", borderRadius: 20, transition: "background-color 0.15s",
                ...(tab === t.value ? { background: INDIGO, color: CREAM } : { background: black(0.05), color: ink(0.5) }),
              }}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Book list */}
        <div className="mt-4 flex flex-col" style={{ gap: 10 }}>
          {filtered === null ? (
            // Loading skeleton
            [0, 1, 2].map((i) => (
              <div key={i} className="animate-pulse" style={card}>
                <div className="flex items-center gap-3">
                  <span style={{ width: 48, height: 67, borderRadius: 6, background: black(0.06) }} />
                  <div className="flex-1">
                    <span className="block" style={{ width: "50%", height: 12, background: black(0.06), borderRadius: 6 }} />
                    <span className="mt-2 block" style={{ width: "30%", height: 10, background: black(0.04), borderRadius: 6 }} />
                  </div>
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="text-center" style={{ ...card, padding: 40 }}>
              <p style={{ fontSize: 24 }}>📚</p>
              <p className="mt-2" style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>
                {tab === "all" ? "Aucun livre ajouté" : `Aucun livre ${statusLabel(tab as BookStatus).toLowerCase()}`}
              </p>
              <p className="mx-auto mt-1" style={{ fontSize: 12, color: DIM, maxWidth: 280, lineHeight: 1.5 }}>
                Ajoute des livres pour suivre tes lectures et partager avec ton réseau.
              </p>
              <button
                type="button"
                onClick={() => setAddOpen(true)}
                className="mt-3 transition hover:brightness-110"
                style={{ background: INDIGO, color: CREAM, borderRadius: 20, padding: "9px 20px", fontSize: 12, fontWeight: 500 }}
              >
                + Ajouter un livre
              </button>
            </div>
          ) : (
            filtered.map((book) => {
              const sc = statusColor(book.status);
              const percent = progressPercent(book);
              return (
                <button
                  key={book.id}
                  type="button"
                  onClick={() => setEditing(book)}
                  className="text-left transition hover:bg-black/[0.02]"
                  style={card}
                >
                  <div className="flex items-start gap-3">
                    <BookCover url={book.cover_url} title={book.title} size={48} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate" style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>{book.title}</p>
                      {book.author && <p className="truncate" style={{ fontSize: 12, color: DIM }}>{book.author}</p>}
                      {percent !== null && (
                        <div className="mt-2">
                          <ProgressBar percent={percent} />
                          <p className="mt-0.5" style={{ fontSize: 10, color: DIM }}>
                            p.{book.page_current} / {book.page_total} · {percent}%
                          </p>
                        </div>
                      )}
                    </div>
                    <span
                      className="shrink-0"
                      style={{ fontSize: 10, padding: "3px 10px", borderRadius: 10, background: sc.bg, color: sc.text }}
                    >
                      {statusLabel(book.status)}
                    </span>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Network reading section */}
        {networkBooks !== null && networkBooks.length > 0 && (
          <section className="mt-10">
            <h2 style={{ fontFamily: GEORGIA, fontSize: 20, fontWeight: 400, color: TEXT }}>Ce que lit ton réseau</h2>
            <p className="mb-4 mt-1" style={{ fontSize: 13, color: DIM }}>Les lectures en cours de tes abonnements</p>
            <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
              {networkBooks.map((book) => (
                <NetworkBookCard key={book.id} book={book} />
              ))}
            </div>
          </section>
        )}
      </main>

      {addOpen && <AddBookModal userId={userId!} onClose={() => setAddOpen(false)} onAdded={reload} />}
      {editing && (
        <EditBookModal
          book={editing}
          onClose={() => setEditing(null)}
          onUpdated={() => { reload(); setEditing(null); }}
          onDeleted={() => { reload(); setEditing(null); }}
        />
      )}
    </div>
  );
}

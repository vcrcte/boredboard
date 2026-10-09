"use client";

import { useCallback, useEffect, useState, useRef, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import {
  FORUM_CATEGORIES,
  getForumPosts,
  createForumPost,
  timeAgo,
  type ForumPost,
} from "@/lib/forum";
import { supabase } from "@/lib/supabase";

/* ── design tokens ─────────────────────────────────────── */
const CREAM = "#F7F4EE";
const INDIGO = "#2A3560";
const GOLD = "#C4A94A";
const TEXT = "#1C1A15";
const GEORGIA = "Georgia, 'Times New Roman', serif";
const ink = (a: number) => `rgba(28,26,21,${a})`;
const DIM = ink(0.4);

const CATEGORY_COLORS: Record<string, string> = {
  "Général": "#6B7280",
  "Culture": "#8B5CF6",
  "Séries": "#EC4899",
  "Musique": "#F59E0B",
  "Livres": "#10B981",
  "Cinéma": "#EF4444",
  "Actualités": "#3B82F6",
  "Science": "#06B6D4",
  "Philosophie": "#8B6914",
  "Suggestions": GOLD,
};

/* ── fade-in hook ──────────────────────────────────────── */
function useFadeIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(12px)";
    el.style.transition = "opacity .45s ease, transform .45s ease";
    const t = setTimeout(() => {
      el.style.opacity = "1";
      el.style.transform = "translateY(0)";
    }, 60 + delay * 50);
    return () => clearTimeout(t);
  }, [delay]);
  return ref;
}

/* ── loading skeleton ──────────────────────────────────── */
function PostSkeleton() {
  return (
    <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div className="flex items-center gap-2">
            <span className="bb-skeleton" style={{ width: 56, height: 18, borderRadius: 8 }} />
            <span className="bb-skeleton" style={{ width: "60%", height: 16, borderRadius: 6 }} />
          </div>
          <span className="bb-skeleton" style={{ width: "85%", height: 14, borderRadius: 6 }} />
          <div className="flex items-center gap-3">
            <span className="bb-skeleton" style={{ width: 72, height: 12, borderRadius: 6 }} />
            <span className="bb-skeleton" style={{ width: 48, height: 12, borderRadius: 6 }} />
          </div>
        </div>
        <span className="bb-skeleton" style={{ width: 48, height: 48, borderRadius: 10, flexShrink: 0 }} />
      </div>
    </div>
  );
}

function LoadingList() {
  return (
    <div className="bb-card" style={{ overflow: "hidden" }}>
      {Array.from({ length: 5 }).map((_, i) => (
        <PostSkeleton key={i} />
      ))}
    </div>
  );
}

/* ── post row ──────────────────────────────────────────── */
function PostRow({ post, index }: { post: ForumPost; index: number }) {
  const ref = useFadeIn(index);
  const catColor = CATEGORY_COLORS[post.category] ?? INDIGO;

  return (
    <div ref={ref}>
      <Link
        href={`/forum/${post.id}`}
        className="block"
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid rgba(0,0,0,0.04)",
          transition: "background-color .15s ease",
        }}
        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.015)")}
        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="bb-chip"
                style={{
                  fontSize: 10,
                  padding: "2px 10px",
                  background: `${catColor}14`,
                  color: catColor,
                }}
              >
                {post.category}
              </span>
              <h3
                className="truncate"
                style={{ fontSize: 14, fontWeight: 500, color: TEXT }}
              >
                {post.title}
              </h3>
            </div>
            <p
              className="mt-1 line-clamp-1"
              style={{ fontSize: 12, color: DIM, lineHeight: 1.5 }}
            >
              {post.body}
            </p>
            <div className="mt-2 flex items-center gap-3" style={{ fontSize: 11, color: DIM }}>
              <span style={{ fontWeight: 500, color: ink(0.55) }}>{post.author_name}</span>
              <span style={{ opacity: 0.4 }}>·</span>
              <span>{timeAgo(post.created_at)}</span>
            </div>
          </div>
          <div
            className="flex shrink-0 flex-col items-center justify-center"
            style={{
              minWidth: 48,
              padding: "8px 0",
              borderRadius: 10,
              background: post.reply_count > 0 ? `${INDIGO}08` : "transparent",
              transition: "background-color .15s ease",
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 600, color: post.reply_count > 0 ? INDIGO : DIM }}>
              {post.reply_count}
            </span>
            <span style={{ fontSize: 9, color: DIM, letterSpacing: "0.02em" }}>
              {post.reply_count === 1 ? "réponse" : "réponses"}
            </span>
          </div>
        </div>
      </Link>
    </div>
  );
}

/* ── main ──────────────────────────────────────────────── */
export default function Forum() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [posts, setPosts] = useState<ForumPost[] | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newBody, setNewBody] = useState("");
  const [newCategory, setNewCategory] = useState<string>("Général");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setSession(data.session);
    });
  }, [router]);

  const userId = session?.user.id;

  const loadPosts = useCallback(async () => {
    const list = await getForumPosts(categoryFilter ?? undefined);
    setPosts(list);
  }, [categoryFilter]);

  useEffect(() => { loadPosts(); }, [loadPosts]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId || !newTitle.trim() || !newBody.trim()) return;
    setSubmitting(true);

    const name =
      session?.user.user_metadata?.display_name ||
      session?.user.user_metadata?.full_name ||
      session?.user.email?.split("@")[0] ||
      "Anonyme";

    const post = await createForumPost(userId, name, newTitle.trim(), newBody.trim(), newCategory);
    if (post) {
      setNewTitle("");
      setNewBody("");
      setNewCategory("Général");
      setShowNew(false);
      await loadPosts();
    }
    setSubmitting(false);
  };

  if (!session) return <div className="min-h-screen" style={{ background: CREAM }} />;

  const loading = posts === null;

  return (
    <div className="page-enter min-h-screen" style={{ background: CREAM, color: TEXT }}>
      <Navbar />
      <main className="mx-auto px-4 sm:px-6" style={{ maxWidth: 800, paddingBlock: 32 }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 style={{ fontFamily: GEORGIA, fontSize: 28, fontWeight: 400, color: TEXT }}>Forum</h1>
            <p className="mt-1" style={{ fontSize: 13, color: DIM, letterSpacing: "0.01em" }}>
              Discutez, partagez, débattez avec la communauté
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="bb-btn-primary shrink-0"
          >
            {showNew ? "Annuler" : "+ Nouveau sujet"}
          </button>
        </div>

        {/* New post form */}
        {showNew && (
          <form onSubmit={handleSubmit} className="bb-card mt-5" style={{ padding: 20 }}>
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  className="bb-input"
                  style={{ fontSize: 12, padding: "8px 12px" }}
                >
                  {FORUM_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <input
                  type="text"
                  placeholder="Titre du sujet"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  maxLength={150}
                  className="bb-input flex-1"
                  style={{ fontSize: 13 }}
                />
              </div>
              <textarea
                placeholder="Votre message..."
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={4}
                className="bb-input"
                style={{
                  fontSize: 13,
                  resize: "vertical",
                  lineHeight: 1.6,
                }}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !newTitle.trim() || !newBody.trim()}
                  className="bb-btn-primary"
                >
                  {submitting ? "Publication…" : "Publier"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Category chips */}
        <div className="mt-5 flex flex-wrap" style={{ gap: 6 }}>
          <button
            type="button"
            onClick={() => setCategoryFilter(null)}
            className={categoryFilter === null ? "bb-chip bb-chip-active" : "bb-chip bb-chip-inactive"}
          >
            Tous
          </button>
          {FORUM_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              className={categoryFilter === cat ? "bb-chip bb-chip-active" : "bb-chip bb-chip-inactive"}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Posts list */}
        {loading ? (
          <div className="mt-5">
            <LoadingList />
          </div>
        ) : posts.length === 0 ? (
          <div className="bb-card mt-5 text-center" style={{ padding: 48 }}>
            <p style={{ fontSize: 28 }}>◈</p>
            <p className="mt-2" style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>
              {categoryFilter ? "Aucun sujet dans cette catégorie" : "Aucun sujet pour le moment"}
            </p>
            <p className="mx-auto mt-1" style={{ fontSize: 12, color: DIM, maxWidth: 300, lineHeight: 1.5 }}>
              Sois le premier à lancer une discussion !
            </p>
            {!showNew && (
              <button
                type="button"
                onClick={() => setShowNew(true)}
                className="bb-btn-primary mt-4"
              >
                Créer un sujet
              </button>
            )}
          </div>
        ) : (
          <div className="bb-card mt-5" style={{ overflow: "hidden" }}>
            {posts.map((post, i) => (
              <PostRow key={post.id} post={post} index={i} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

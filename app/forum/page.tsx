"use client";

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
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

const CREAM = "#F7F4EE";
const INDIGO = "#2A3560";
const GOLD = "#C4A94A";
const TEXT = "#1C1A15";
const WHITE = "#FFFFFF";
const GEORGIA = "Georgia, 'Times New Roman', serif";
const ink = (a: number) => `rgba(28,26,21,${a})`;
const black = (a: number) => `rgba(0,0,0,${a})`;
const DIM = ink(0.4);

const card: CSSProperties = {
  background: WHITE,
  border: `1px solid ${black(0.07)}`,
  borderRadius: 14,
  overflow: "hidden",
};

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

function PostRow({ post }: { post: ForumPost }) {
  const catColor = CATEGORY_COLORS[post.category] ?? INDIGO;
  return (
    <Link
      href={`/forum/${post.id}`}
      className="block transition"
      style={{
        padding: "16px 20px",
        borderBottom: `1px solid ${black(0.05)}`,
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 8,
                background: `${catColor}14`,
                color: catColor,
                fontWeight: 500,
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
            <span>{post.author_name}</span>
            <span>·</span>
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
          }}
        >
          <span style={{ fontSize: 16, fontWeight: 600, color: post.reply_count > 0 ? INDIGO : DIM }}>
            {post.reply_count}
          </span>
          <span style={{ fontSize: 9, color: DIM }}>
            {post.reply_count === 1 ? "réponse" : "réponses"}
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function Forum() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [posts, setPosts] = useState<ForumPost[]>([]);
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

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <Navbar />
      <main className="mx-auto px-4 sm:px-6" style={{ maxWidth: 800, paddingBlock: 32 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 style={{ fontFamily: GEORGIA, fontSize: 28, fontWeight: 400, color: TEXT }}>Forum</h1>
            <p className="mt-1" style={{ fontSize: 13, color: DIM }}>Discutez, partagez, débattez avec la communauté</p>
          </div>
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="shrink-0 transition hover:brightness-110"
            style={{
              background: INDIGO,
              color: CREAM,
              borderRadius: 20,
              padding: "9px 20px",
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            {showNew ? "Annuler" : "+ Nouveau sujet"}
          </button>
        </div>

        {/* New post form */}
        {showNew && (
          <form onSubmit={handleSubmit} className="mt-5" style={{ ...card, padding: 20 }}>
            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                  style={{
                    fontSize: 12,
                    padding: "8px 12px",
                    borderRadius: 10,
                    border: `1px solid ${black(0.1)}`,
                    background: WHITE,
                    color: TEXT,
                    outline: "none",
                  }}
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
                  className="flex-1"
                  style={{
                    fontSize: 13,
                    padding: "8px 14px",
                    borderRadius: 10,
                    border: `1px solid ${black(0.1)}`,
                    background: WHITE,
                    color: TEXT,
                    outline: "none",
                  }}
                />
              </div>
              <textarea
                placeholder="Votre message..."
                value={newBody}
                onChange={(e) => setNewBody(e.target.value)}
                rows={4}
                style={{
                  fontSize: 13,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: `1px solid ${black(0.1)}`,
                  background: WHITE,
                  color: TEXT,
                  outline: "none",
                  resize: "vertical",
                  lineHeight: 1.6,
                }}
              />
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={submitting || !newTitle.trim() || !newBody.trim()}
                  className="transition disabled:opacity-50"
                  style={{
                    background: INDIGO,
                    color: CREAM,
                    borderRadius: 20,
                    padding: "9px 24px",
                    fontSize: 12,
                    fontWeight: 500,
                  }}
                >
                  {submitting ? "Publication…" : "Publier"}
                </button>
              </div>
            </div>
          </form>
        )}

        {/* Category filters */}
        <div className="mt-5 flex flex-wrap" style={{ gap: 6 }}>
          <button
            type="button"
            onClick={() => setCategoryFilter(null)}
            style={{
              fontSize: 11,
              padding: "5px 14px",
              borderRadius: 20,
              ...(categoryFilter === null
                ? { background: INDIGO, color: CREAM }
                : { background: black(0.05), color: ink(0.5) }),
            }}
          >
            Tous
          </button>
          {FORUM_CATEGORIES.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
              style={{
                fontSize: 11,
                padding: "5px 14px",
                borderRadius: 20,
                ...(categoryFilter === cat
                  ? { background: INDIGO, color: CREAM }
                  : { background: black(0.05), color: ink(0.5) }),
              }}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Posts list */}
        <div className="mt-5" style={card}>
          {posts.length === 0 ? (
            <div className="text-center" style={{ padding: 48 }}>
              <p style={{ fontSize: 28 }}>💬</p>
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
                  className="mt-4 transition hover:brightness-110"
                  style={{ background: INDIGO, color: CREAM, borderRadius: 20, padding: "9px 20px", fontSize: 12, fontWeight: 500 }}
                >
                  Créer un sujet
                </button>
              )}
            </div>
          ) : (
            posts.map((post) => <PostRow key={post.id} post={post} />)
          )}
        </div>
      </main>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState, useRef, type FormEvent } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import {
  getForumPost,
  getPostReplies,
  createReply,
  deleteForumPost,
  deleteReply,
  timeAgo,
  type ForumPost,
  type ForumReply,
} from "@/lib/forum";
import { supabase } from "@/lib/supabase";

/* ── design tokens ─────────────────────────────────────── */
const CREAM = "#F7F4EE";
const INDIGO = "#2A3560";
const TEXT = "#1C1A15";
const GEORGIA = "Georgia, 'Times New Roman', serif";
const ink = (a: number) => `rgba(28,26,21,${a})`;
const DIM = ink(0.4);
const RED = "#DC2626";

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
  "Suggestions": "#C4A94A",
};

/* ── fade-in hook ──────────────────────────────────────── */
function useFadeIn(delay = 0, ready = true) {
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
  }, [delay, ready]);
  return ref;
}

/* ── loading skeleton ──────────────────────────────────── */
function TopicSkeleton() {
  return (
    <div className="page-enter" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      {/* Back link skeleton */}
      <span className="bb-skeleton" style={{ width: 120, height: 14, borderRadius: 6 }} />

      {/* Post skeleton */}
      <div className="bb-card" style={{ padding: 24, display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="flex items-center gap-2">
          <span className="bb-skeleton" style={{ width: 56, height: 18, borderRadius: 8 }} />
          <span className="bb-skeleton" style={{ width: 80, height: 14, borderRadius: 6 }} />
          <span className="bb-skeleton" style={{ width: 64, height: 14, borderRadius: 6 }} />
        </div>
        <span className="bb-skeleton" style={{ width: "75%", height: 22, borderRadius: 6 }} />
        <span className="bb-skeleton" style={{ width: "100%", height: 14, borderRadius: 6 }} />
        <span className="bb-skeleton" style={{ width: "90%", height: 14, borderRadius: 6 }} />
        <span className="bb-skeleton" style={{ width: "60%", height: 14, borderRadius: 6 }} />
      </div>

      {/* Reply section skeleton */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="bb-skeleton" style={{ width: 100, height: 16, borderRadius: 6 }} />
        {[0, 1].map((i) => (
          <div key={i} className="bb-card" style={{ padding: 16, display: "flex", flexDirection: "column", gap: 8 }}>
            <div className="flex items-center gap-2">
              <span className="bb-skeleton" style={{ width: 72, height: 14, borderRadius: 6 }} />
              <span className="bb-skeleton" style={{ width: 48, height: 14, borderRadius: 6 }} />
            </div>
            <span className="bb-skeleton" style={{ width: "85%", height: 14, borderRadius: 6 }} />
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── reply card ─────────────────────────────────────────── */
function ReplyCard({ reply, isOwn, onDelete, index }: {
  reply: ForumReply;
  isOwn: boolean;
  onDelete: () => void;
  index: number;
}) {
  const ref = useFadeIn(index + 1);

  return (
    <div ref={ref} className="bb-card" style={{ padding: 16 }}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2" style={{ fontSize: 11, color: DIM }}>
          <span style={{ fontWeight: 500, color: ink(0.6) }}>{reply.author_name}</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span>{timeAgo(reply.created_at)}</span>
        </div>
        {isOwn && (
          <button
            type="button"
            onClick={onDelete}
            className="bb-btn-ghost"
            style={{ fontSize: 10, color: DIM, padding: "4px 8px" }}
          >
            Supprimer
          </button>
        )}
      </div>
      <div
        className="mt-2"
        style={{ fontSize: 13, color: TEXT, lineHeight: 1.7, whiteSpace: "pre-wrap" }}
      >
        {reply.body}
      </div>
    </div>
  );
}

/* ── main ──────────────────────────────────────────────── */
export default function TopicPage() {
  const router = useRouter();
  const params = useParams();
  const postId = params.id as string;

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [post, setPost] = useState<ForumPost | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setSession(data.session);
    });
  }, [router]);

  const userId = session?.user.id;

  const load = useCallback(async () => {
    if (!postId) return;
    const [p, r] = await Promise.all([getForumPost(postId), getPostReplies(postId)]);
    setPost(p);
    setReplies(r);
    setLoading(false);
  }, [postId]);

  useEffect(() => { load(); }, [load]);

  const handleReply = async (e: FormEvent) => {
    e.preventDefault();
    if (!userId || !replyBody.trim()) return;
    setSubmitting(true);

    const name =
      session?.user.user_metadata?.display_name ||
      session?.user.user_metadata?.full_name ||
      session?.user.email?.split("@")[0] ||
      "Anonyme";

    await createReply(postId, userId, name, replyBody.trim());
    setReplyBody("");
    await load();
    setSubmitting(false);
  };

  const handleDeletePost = async () => {
    if (!userId || !post) return;
    if (!confirm("Supprimer ce sujet et toutes ses réponses ?")) return;
    setDeleting(true);
    await deleteForumPost(post.id, userId);
    router.push("/forum");
  };

  const handleDeleteReply = async (replyId: string) => {
    if (!userId) return;
    await deleteReply(replyId, userId, postId);
    await load();
  };

  const postRef = useFadeIn(0, !!post);

  if (!session) return <div className="min-h-screen" style={{ background: CREAM }} />;

  if (loading) {
    return (
      <div className="min-h-screen" style={{ background: CREAM, color: TEXT }}>
        <Navbar />
        <main className="mx-auto px-4 sm:px-6" style={{ maxWidth: 800, paddingBlock: 32 }}>
          <TopicSkeleton />
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="page-enter min-h-screen" style={{ background: CREAM, color: TEXT }}>
        <Navbar />
        <main className="mx-auto px-4 sm:px-6" style={{ maxWidth: 800, paddingBlock: 32 }}>
          <div className="bb-card text-center" style={{ padding: 48 }}>
            <p style={{ fontSize: 28 }}>◎</p>
            <p className="mt-2" style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>Sujet introuvable</p>
            <Link href="/forum" className="bb-btn-primary mt-4 inline-block">
              Retour au forum
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const catColor = CATEGORY_COLORS[post.category] ?? INDIGO;
  const isAuthor = userId === post.user_id;

  return (
    <div className="page-enter min-h-screen" style={{ background: CREAM, color: TEXT }}>
      <Navbar />
      <main className="mx-auto px-4 sm:px-6" style={{ maxWidth: 800, paddingBlock: 32 }}>
        {/* Back link */}
        <Link
          href="/forum"
          className="inline-flex items-center gap-1"
          style={{
            fontSize: 12,
            color: DIM,
            marginBottom: 16,
            transition: "color .15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = TEXT)}
          onMouseLeave={(e) => (e.currentTarget.style.color = DIM)}
        >
          ← Retour au forum
        </Link>

        {/* Post */}
        <div ref={postRef}>
          <article className="bb-card" style={{ padding: 24 }}>
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
              <span style={{ fontSize: 11, color: DIM, fontWeight: 500 }}>{post.author_name}</span>
              <span style={{ fontSize: 11, color: DIM, opacity: 0.4 }}>·</span>
              <span style={{ fontSize: 11, color: DIM }}>{timeAgo(post.created_at)}</span>
            </div>

            <h1 className="mt-3" style={{ fontFamily: GEORGIA, fontSize: 22, fontWeight: 400, color: TEXT, lineHeight: 1.4 }}>
              {post.title}
            </h1>

            <div className="bb-divider" style={{ marginBlock: 16 }} />

            <div style={{ fontSize: 14, color: TEXT, lineHeight: 1.75, whiteSpace: "pre-wrap" }}>
              {post.body}
            </div>

            {isAuthor && (
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={handleDeletePost}
                  disabled={deleting}
                  className="bb-btn-ghost"
                  style={{ fontSize: 11, color: RED, padding: "6px 12px" }}
                >
                  {deleting ? "Suppression…" : "Supprimer ce sujet"}
                </button>
              </div>
            )}
          </article>
        </div>

        {/* Replies */}
        <div className="mt-6">
          <h2 style={{ fontSize: 14, fontWeight: 500, color: TEXT, letterSpacing: "0.01em" }}>
            {replies.length} réponse{replies.length !== 1 ? "s" : ""}
          </h2>

          <div className="mt-3 flex flex-col" style={{ gap: 8 }}>
            {replies.map((reply, i) => (
              <ReplyCard
                key={reply.id}
                reply={reply}
                isOwn={userId === reply.user_id}
                onDelete={() => handleDeleteReply(reply.id)}
                index={i}
              />
            ))}
          </div>
        </div>

        {/* Reply form */}
        <form onSubmit={handleReply} className="bb-card mt-6" style={{ padding: 16 }}>
          <textarea
            placeholder="Votre réponse..."
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            rows={3}
            className="bb-input"
            style={{
              width: "100%",
              fontSize: 13,
              resize: "vertical",
              lineHeight: 1.6,
              boxSizing: "border-box",
            }}
          />
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={submitting || !replyBody.trim()}
              className="bb-btn-primary"
            >
              {submitting ? "Envoi…" : "Répondre"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

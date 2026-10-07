"use client";

import { useCallback, useEffect, useState, type CSSProperties, type FormEvent } from "react";
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

const CREAM = "#F7F4EE";
const INDIGO = "#2A3560";
const TEXT = "#1C1A15";
const WHITE = "#FFFFFF";
const GEORGIA = "Georgia, 'Times New Roman', serif";
const ink = (a: number) => `rgba(28,26,21,${a})`;
const black = (a: number) => `rgba(0,0,0,${a})`;
const DIM = ink(0.4);
const RED = "#DC2626";

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
  "Suggestions": "#C4A94A",
};

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

  if (!session || loading) return <div className="min-h-screen" style={{ background: CREAM }} />;

  if (!post) {
    return (
      <div className="min-h-screen" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
        <Navbar />
        <main className="mx-auto px-4 sm:px-6" style={{ maxWidth: 800, paddingBlock: 32 }}>
          <div className="text-center" style={{ ...card, padding: 48 }}>
            <p style={{ fontSize: 28 }}>🔍</p>
            <p className="mt-2" style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>Sujet introuvable</p>
            <Link
              href="/forum"
              className="mt-4 inline-block transition hover:brightness-110"
              style={{ background: INDIGO, color: CREAM, borderRadius: 20, padding: "9px 20px", fontSize: 12, fontWeight: 500 }}
            >
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
    <div className="min-h-screen" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <Navbar />
      <main className="mx-auto px-4 sm:px-6" style={{ maxWidth: 800, paddingBlock: 32 }}>
        {/* Back link */}
        <Link
          href="/forum"
          className="inline-flex items-center gap-1 transition hover:underline"
          style={{ fontSize: 12, color: DIM, marginBottom: 16 }}
        >
          ← Retour au forum
        </Link>

        {/* Post */}
        <article style={{ ...card, padding: 24 }}>
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
            <span style={{ fontSize: 11, color: DIM }}>{post.author_name}</span>
            <span style={{ fontSize: 11, color: DIM }}>·</span>
            <span style={{ fontSize: 11, color: DIM }}>{timeAgo(post.created_at)}</span>
          </div>

          <h1 className="mt-3" style={{ fontFamily: GEORGIA, fontSize: 22, fontWeight: 400, color: TEXT, lineHeight: 1.4 }}>
            {post.title}
          </h1>

          <div
            className="mt-4"
            style={{ fontSize: 14, color: TEXT, lineHeight: 1.7, whiteSpace: "pre-wrap" }}
          >
            {post.body}
          </div>

          {isAuthor && (
            <div className="mt-4 flex justify-end">
              <button
                type="button"
                onClick={handleDeletePost}
                disabled={deleting}
                style={{ fontSize: 11, color: RED, background: "none", border: "none", cursor: "pointer" }}
              >
                {deleting ? "Suppression…" : "Supprimer ce sujet"}
              </button>
            </div>
          )}
        </article>

        {/* Replies */}
        <div className="mt-6">
          <h2 style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>
            {replies.length} réponse{replies.length !== 1 ? "s" : ""}
          </h2>

          <div className="mt-3 flex flex-col" style={{ gap: 8 }}>
            {replies.map((reply) => (
              <div key={reply.id} style={{ ...card, padding: 16 }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2" style={{ fontSize: 11, color: DIM }}>
                    <span style={{ fontWeight: 500, color: TEXT }}>{reply.author_name}</span>
                    <span>·</span>
                    <span>{timeAgo(reply.created_at)}</span>
                  </div>
                  {userId === reply.user_id && (
                    <button
                      type="button"
                      onClick={() => handleDeleteReply(reply.id)}
                      style={{ fontSize: 10, color: DIM, background: "none", border: "none", cursor: "pointer" }}
                    >
                      Supprimer
                    </button>
                  )}
                </div>
                <div
                  className="mt-2"
                  style={{ fontSize: 13, color: TEXT, lineHeight: 1.6, whiteSpace: "pre-wrap" }}
                >
                  {reply.body}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reply form */}
        <form onSubmit={handleReply} className="mt-6" style={{ ...card, padding: 16 }}>
          <textarea
            placeholder="Votre réponse..."
            value={replyBody}
            onChange={(e) => setReplyBody(e.target.value)}
            rows={3}
            style={{
              width: "100%",
              fontSize: 13,
              padding: "10px 14px",
              borderRadius: 10,
              border: `1px solid ${black(0.1)}`,
              background: WHITE,
              color: TEXT,
              outline: "none",
              resize: "vertical",
              lineHeight: 1.6,
              boxSizing: "border-box",
            }}
          />
          <div className="mt-3 flex justify-end">
            <button
              type="submit"
              disabled={submitting || !replyBody.trim()}
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
              {submitting ? "Envoi…" : "Répondre"}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

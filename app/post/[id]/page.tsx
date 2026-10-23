"use client";

import { useEffect, useState, useCallback, FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { avatarTones } from "@/lib/sample-data";
import { getInitials } from "@/components/Navbar";

/* ── fonts ────────────────────────────────────────────────── */
const fontImports = `
@import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&f[]=cabinet-grotesk@800&display=swap');
@import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Literata:ital,wght@0,400;1,400&family=JetBrains+Mono:wght@400&display=swap');
`;

/* ── design tokens ────────────────────────────────────────── */
const DISPLAY = "'Cabinet Grotesk', system-ui, sans-serif";
const UI = "Satoshi, system-ui, sans-serif";
const READING = "Literata, Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const HERO_SERIF = "'DM Serif Display', Literata, Georgia, serif";

const DARK = {
  ground: "#162550",
  surface: "#1E3068",
  text: "#E6E8E3",
  muted: "#A3A8B8",
  primary: "#8E9BE0",
  onPrimary: "#162550",
  line: "rgba(255,255,255,0.10)",
  ink: (a: number) => `rgba(230,232,227,${a})`,
};
const LIGHT = {
  ground: "#ECEEEA",
  surface: "#FAFAF8",
  text: "#15171A",
  muted: "#5D6168",
  primary: "#2A3560",
  onPrimary: "#FAFAF8",
  line: "rgba(21,23,26,0.10)",
  ink: (a: number) => `rgba(21,23,26,${a})`,
};

type Theme = typeof DARK;

const POST_SELECT =
  "*, profiles!posts_user_id_fkey (id, name, username, avatar_url)";

/* ── types ────────────────────────────────────────────────── */
interface Profile {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
}

interface Post {
  id: string;
  user_id: string;
  type: string;
  content: string;
  metadata: Record<string, unknown> | null;
  url: string | null;
  created_at: string;
  profiles: Profile;
}

interface Interaction {
  id: string;
  post_id: string;
  user_id: string;
  type: string;
  content: string | null;
  created_at: string;
  profiles: Profile;
}

interface OgData {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  domain?: string;
}

/* ── helpers ──────────────────────────────────────────────── */
function useTheme(): Theme {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    try {
      const stored = localStorage.getItem("theme");
      if (stored === "light") setDark(false);
    } catch {}
  }, []);
  return dark ? DARK : LIGHT;
}

function timeAgo(date: string): string {
  const seconds = Math.floor(
    (Date.now() - new Date(date).getTime()) / 1000
  );
  if (seconds < 60) return "à l'instant";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `il y a ${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days}j`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `il y a ${weeks}sem`;
  const months = Math.floor(days / 30);
  if (months < 12) return `il y a ${months}mo`;
  return `il y a ${Math.floor(months / 12)}a`;
}

function avatarColor(userId: string) {
  const idx =
    userId.split("").reduce((a, c) => a + c.charCodeAt(0), 0) %
    avatarTones.length;
  return avatarTones[idx]; // { background, color }
}

/* ── avatar component ─────────────────────────────────────── */
function Avatar({
  profile,
  size = 40,
}: {
  profile: Profile;
  size?: number;
  t?: Theme;
}) {
  const bg = avatarColor(profile.id);
  if (profile.avatar_url) {
    return (
      <img
        src={profile.avatar_url}
        alt={profile.name}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          flexShrink: 0,
        }}
      />
    );
  }
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg.background,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: UI,
        fontWeight: 700,
        fontSize: size * 0.38,
        color: bg.color,
        flexShrink: 0,
      }}
    >
      {getInitials(profile.name, profile.username)}
    </div>
  );
}

/* ── main page ────────────────────────────────────────────── */
export default function PostDetailPage() {
  const params = useParams();
  const router = useRouter();
  const postId = params?.id as string | undefined;
  const t = useTheme();

  const [post, setPost] = useState<Post | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [ogData, setOgData] = useState<OgData | null>(null);
  const [ogLoading, setOgLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [session, setSession] = useState<{ access_token: string } | null>(
    null
  );

  /* auth */
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setCurrentUserId(data.session.user.id);
        setSession({ access_token: data.session.access_token });
      }
    });
  }, []);

  /* load post */
  const loadPost = useCallback(async () => {
    if (!postId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT)
      .eq("id", postId)
      .single();
    if (!error && data) setPost(data as unknown as Post);
    setLoading(false);
  }, [postId]);

  /* load interactions */
  const loadInteractions = useCallback(async () => {
    if (!postId) return;
    const { data } = await supabase
      .from("interactions")
      .select("*, profiles!interactions_user_id_fkey (id, name, username, avatar_url)")
      .eq("post_id", postId)
      .order("created_at", { ascending: true });
    if (data) setInteractions(data as unknown as Interaction[]);
  }, [postId]);

  useEffect(() => {
    loadPost();
    loadInteractions();
  }, [loadPost, loadInteractions]);

  /* OG preview for articles */
  useEffect(() => {
    if (!post || post.type !== "article" || !post.url || !session) return;
    setOgLoading(true);
    fetch(`/api/og?url=${encodeURIComponent(post.url)}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then((r) => r.json())
      .then((d: OgData) => setOgData(d))
      .catch(() => {})
      .finally(() => setOgLoading(false));
  }, [post, session]);

  /* submit comment */
  const handleComment = async (e: FormEvent) => {
    e.preventDefault();
    if (!commentText.trim() || !currentUserId || !postId || submitting) return;
    setSubmitting(true);
    await supabase.from("interactions").insert({
      post_id: postId,
      user_id: currentUserId,
      type: "comment",
      content: commentText.trim(),
    });
    setCommentText("");
    await loadInteractions();
    setSubmitting(false);
  };

  /* derived data */
  const likes = interactions.filter((i) => i.type === "like");
  const comments = interactions.filter((i) => i.type === "comment");

  const likedByLine = (() => {
    if (likes.length === 0) return null;
    const names = likes.map((l) => l.profiles.name);
    if (names.length === 1) return `Aimé par ${names[0]}`;
    if (names.length === 2) return `Aimé par ${names[0]} et ${names[1]}`;
    const rest = names.slice(0, -1).join(", ");
    return `Aimé par ${rest} et ${names[names.length - 1]}`;
  })();

  /* metadata helpers */
  const meta = post?.metadata as Record<string, string> | null;

  /* ── render ──────────────────────────────────────────────── */
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: fontImports }} />
      <div
        style={{
          minHeight: "100vh",
          background: t.ground,
          color: t.text,
          fontFamily: UI,
        }}
      >
        {/* header */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 50,
            background: t.ground,
            borderBottom: `1px solid ${t.line}`,
            padding: "0 16px",
          }}
        >
          <div
            style={{
              maxWidth: 680,
              margin: "0 auto",
              height: 56,
              display: "flex",
              alignItems: "center",
              gap: 16,
            }}
          >
            <button
              onClick={() => router.push("/dashboard")}
              aria-label="Retour"
              style={{
                background: "none",
                border: "none",
                color: t.text,
                cursor: "pointer",
                padding: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 5l-7 7 7 7" />
              </svg>
            </button>
            <Link
              href="/dashboard"
              style={{
                fontFamily: HERO_SERIF,
                fontSize: 22,
                color: t.text,
                textDecoration: "none",
                letterSpacing: "-0.02em",
              }}
            >
              boredboard
            </Link>
          </div>
        </header>

        {/* main content */}
        <main style={{ maxWidth: 680, margin: "0 auto", padding: "32px 16px 80px" }}>
          {loading && (
            <p style={{ color: t.muted, fontFamily: UI, textAlign: "center" }}>
              Chargement…
            </p>
          )}

          {!loading && !post && (
            <p style={{ color: t.muted, fontFamily: UI, textAlign: "center" }}>
              Post introuvable.
            </p>
          )}

          {!loading && post && (
            <>
              {/* ── post card ──────────────────────────────── */}
              <article
                style={{
                  background: t.surface,
                  borderRadius: 16,
                  border: `1px solid ${t.line}`,
                  padding: 24,
                  marginBottom: 24,
                }}
              >
                {/* author row */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 20,
                  }}
                >
                  <Avatar profile={post.profiles} size={44} t={t} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontFamily: UI,
                        fontWeight: 700,
                        fontSize: 15,
                        color: t.text,
                        lineHeight: 1.3,
                      }}
                    >
                      {post.profiles.name}
                    </div>
                    <div
                      style={{
                        fontFamily: MONO,
                        fontSize: 12,
                        color: t.muted,
                        lineHeight: 1.4,
                      }}
                    >
                      @{post.profiles.username} · {timeAgo(post.created_at)}
                    </div>
                  </div>
                </div>

                {/* content text */}
                {post.content && (
                  <p
                    style={{
                      fontFamily: READING,
                      fontSize: 16,
                      lineHeight: 1.7,
                      color: t.text,
                      margin: "0 0 20px",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                    }}
                  >
                    {post.content}
                  </p>
                )}

                {/* ── type-specific blocks ─────────────────── */}

                {/* musique */}
                {post.type === "musique" && meta && (
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      background: t.ink(0.05),
                      borderRadius: 12,
                      padding: 16,
                      alignItems: "center",
                    }}
                  >
                    {meta.artwork && (
                      <img
                        src={meta.artwork}
                        alt={meta.title || "Album art"}
                        style={{
                          width: 96,
                          height: 96,
                          borderRadius: 8,
                          objectFit: "cover",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {meta.title && (
                        <div
                          style={{
                            fontFamily: UI,
                            fontWeight: 700,
                            fontSize: 16,
                            color: t.text,
                            marginBottom: 2,
                          }}
                        >
                          {meta.title}
                        </div>
                      )}
                      {meta.artist && (
                        <div
                          style={{
                            fontFamily: UI,
                            fontSize: 14,
                            color: t.muted,
                            marginBottom: 10,
                          }}
                        >
                          {meta.artist}
                        </div>
                      )}
                      {post.url && (
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontFamily: UI,
                            fontSize: 13,
                            fontWeight: 500,
                            color: t.primary,
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          Écouter
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                          </svg>
                        </a>
                      )}
                    </div>
                  </div>
                )}

                {/* article */}
                {post.type === "article" && (
                  <div
                    style={{
                      borderRadius: 12,
                      overflow: "hidden",
                      border: `1px solid ${t.line}`,
                    }}
                  >
                    {ogLoading && (
                      <div
                        style={{
                          padding: 32,
                          textAlign: "center",
                          color: t.muted,
                          fontFamily: UI,
                          fontSize: 13,
                        }}
                      >
                        Chargement de l&apos;aperçu…
                      </div>
                    )}
                    {ogData && (
                      <>
                        {ogData.image && (
                          <img
                            src={ogData.image}
                            alt={ogData.title || ""}
                            style={{
                              width: "100%",
                              maxHeight: 340,
                              objectFit: "cover",
                              display: "block",
                            }}
                          />
                        )}
                        <div style={{ padding: 16, background: t.ink(0.03) }}>
                          {ogData.domain && (
                            <div
                              style={{
                                fontFamily: MONO,
                                fontSize: 11,
                                color: t.muted,
                                textTransform: "uppercase",
                                letterSpacing: "0.05em",
                                marginBottom: 6,
                              }}
                            >
                              {ogData.domain}
                            </div>
                          )}
                          {ogData.title && (
                            <div
                              style={{
                                fontFamily: UI,
                                fontWeight: 700,
                                fontSize: 16,
                                color: t.text,
                                lineHeight: 1.4,
                                marginBottom: 6,
                              }}
                            >
                              {ogData.title}
                            </div>
                          )}
                          {ogData.description && (
                            <div
                              style={{
                                fontFamily: READING,
                                fontSize: 14,
                                color: t.muted,
                                lineHeight: 1.5,
                                marginBottom: 12,
                                display: "-webkit-box",
                                WebkitLineClamp: 3,
                                WebkitBoxOrient: "vertical",
                                overflow: "hidden",
                              }}
                            >
                              {ogData.description}
                            </div>
                          )}
                          {post.url && (
                            <a
                              href={post.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{
                                fontFamily: UI,
                                fontSize: 13,
                                fontWeight: 500,
                                color: t.primary,
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              Lire l&apos;article
                              <svg
                                width="14"
                                height="14"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              >
                                <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                              </svg>
                            </a>
                          )}
                        </div>
                      </>
                    )}
                    {!ogLoading && !ogData && post.url && (
                      <div style={{ padding: 16 }}>
                        <a
                          href={post.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontFamily: UI,
                            fontSize: 14,
                            color: t.primary,
                            textDecoration: "none",
                            wordBreak: "break-all",
                          }}
                        >
                          {post.url}
                        </a>
                      </div>
                    )}
                  </div>
                )}

                {/* livre */}
                {post.type === "livre" && meta && (
                  <div
                    style={{
                      display: "flex",
                      gap: 16,
                      background: t.ink(0.05),
                      borderRadius: 12,
                      padding: 16,
                      alignItems: "flex-start",
                    }}
                  >
                    {meta.cover && (
                      <img
                        src={meta.cover}
                        alt={meta.title || "Book cover"}
                        style={{
                          width: 80,
                          height: 120,
                          borderRadius: 6,
                          objectFit: "cover",
                          flexShrink: 0,
                          boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                        }}
                      />
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {meta.title && (
                        <div
                          style={{
                            fontFamily: HERO_SERIF,
                            fontSize: 18,
                            color: t.text,
                            marginBottom: 4,
                            lineHeight: 1.3,
                          }}
                        >
                          {meta.title}
                        </div>
                      )}
                      {meta.author && (
                        <div
                          style={{
                            fontFamily: UI,
                            fontSize: 14,
                            color: t.muted,
                          }}
                        >
                          {meta.author}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* reflexion */}
                {post.type === "reflexion" && (
                  <blockquote
                    style={{
                      margin: 0,
                      padding: "20px 24px",
                      borderLeft: `3px solid ${t.primary}`,
                      background: t.ink(0.04),
                      borderRadius: "0 12px 12px 0",
                      fontFamily: HERO_SERIF,
                      fontSize: 20,
                      lineHeight: 1.6,
                      color: t.text,
                      fontStyle: "italic",
                    }}
                  >
                    {post.content}
                  </blockquote>
                )}
              </article>

              {/* ── likes / social proof ────────────────────── */}
              {likedByLine && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 24,
                    paddingLeft: 4,
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill={t.primary}
                    stroke="none"
                  >
                    <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
                  </svg>
                  <span
                    style={{
                      fontFamily: UI,
                      fontSize: 14,
                      color: t.muted,
                    }}
                  >
                    {likedByLine}
                  </span>
                </div>
              )}

              {/* ── comment thread ──────────────────────────── */}
              <section>
                <h2
                  style={{
                    fontFamily: DISPLAY,
                    fontWeight: 800,
                    fontSize: 18,
                    color: t.text,
                    margin: "0 0 16px",
                    letterSpacing: "-0.01em",
                  }}
                >
                  Commentaires{" "}
                  <span style={{ fontWeight: 400, color: t.muted, fontSize: 15 }}>
                    ({comments.length})
                  </span>
                </h2>

                {comments.length === 0 && (
                  <p
                    style={{
                      fontFamily: UI,
                      fontSize: 14,
                      color: t.muted,
                      marginBottom: 24,
                    }}
                  >
                    Aucun commentaire pour le moment.
                  </p>
                )}

                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 0,
                    marginBottom: 24,
                  }}
                >
                  {comments.map((c, idx) => (
                    <div
                      key={c.id}
                      style={{
                        display: "flex",
                        gap: 12,
                        padding: "14px 0",
                        borderTop:
                          idx === 0 ? `1px solid ${t.line}` : "none",
                        borderBottom: `1px solid ${t.line}`,
                      }}
                    >
                      <Avatar profile={c.profiles} size={32} t={t} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "baseline",
                            gap: 8,
                            marginBottom: 4,
                            flexWrap: "wrap",
                          }}
                        >
                          <span
                            style={{
                              fontFamily: UI,
                              fontWeight: 700,
                              fontSize: 14,
                              color: t.text,
                            }}
                          >
                            {c.profiles.name}
                          </span>
                          <span
                            style={{
                              fontFamily: MONO,
                              fontSize: 11,
                              color: t.muted,
                            }}
                          >
                            {timeAgo(c.created_at)}
                          </span>
                        </div>
                        <p
                          style={{
                            fontFamily: READING,
                            fontSize: 14,
                            lineHeight: 1.6,
                            color: t.text,
                            margin: 0,
                            whiteSpace: "pre-wrap",
                            wordBreak: "break-word",
                          }}
                        >
                          {c.content}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* comment input */}
                {currentUserId && (
                  <form
                    onSubmit={handleComment}
                    style={{
                      display: "flex",
                      gap: 12,
                      alignItems: "flex-end",
                    }}
                  >
                    <input
                      type="text"
                      value={commentText}
                      onChange={(e) => setCommentText(e.target.value)}
                      placeholder="Ajouter un commentaire…"
                      disabled={submitting}
                      style={{
                        flex: 1,
                        fontFamily: UI,
                        fontSize: 14,
                        padding: "12px 16px",
                        borderRadius: 12,
                        border: `1px solid ${t.line}`,
                        background: t.surface,
                        color: t.text,
                        outline: "none",
                        transition: "border-color 0.15s",
                      }}
                      onFocus={(e) =>
                        (e.currentTarget.style.borderColor = t.primary)
                      }
                      onBlur={(e) =>
                        (e.currentTarget.style.borderColor = t.line)
                      }
                    />
                    <button
                      type="submit"
                      disabled={submitting || !commentText.trim()}
                      style={{
                        fontFamily: UI,
                        fontWeight: 600,
                        fontSize: 14,
                        padding: "12px 20px",
                        borderRadius: 12,
                        border: "none",
                        background: t.primary,
                        color: t.onPrimary,
                        cursor:
                          submitting || !commentText.trim()
                            ? "not-allowed"
                            : "pointer",
                        opacity: submitting || !commentText.trim() ? 0.5 : 1,
                        transition: "opacity 0.15s",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                    >
                      {submitting ? "…" : "Envoyer"}
                    </button>
                  </form>
                )}

                {!currentUserId && !loading && (
                  <p
                    style={{
                      fontFamily: UI,
                      fontSize: 13,
                      color: t.muted,
                      textAlign: "center",
                      marginTop: 8,
                    }}
                  >
                    Connecte-toi pour commenter.
                  </p>
                )}
              </section>
            </>
          )}
        </main>
      </div>
    </>
  );
}

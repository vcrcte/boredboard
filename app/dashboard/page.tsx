"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { getInitials } from "@/components/Navbar";
import MusicCard from "@/components/MusicCard";
import SocialActions, { SocialContext, socialCss, type MyInteractions } from "@/components/dashboard/SocialActions";
import { fetchEmbed, parseEmbed, type MusicEmbed } from "@/lib/music";
import { ensureProfile } from "@/lib/profile";
import { claimReferral } from "@/lib/referral";
import { avatarTones } from "@/lib/sample-data";
import { getFollowing, getSuggested, follow as followUser, type PublicProfile } from "@/lib/social";
import { supabase } from "@/lib/supabase";

// ── Design tokens from DESIGN.md ──────────────────────────────────────────
const DISPLAY_FONT = "'Cabinet Grotesk', system-ui, sans-serif";
const UI_FONT = "Satoshi, system-ui, sans-serif";
const READING_FONT = "Literata, Georgia, serif";

const LIGHT = {
  ground: "#ECEEEA",
  surface: "#FAFAF8",
  text: "#15171A",
  muted: "#5D6168",
  primary: "#2A3560",
  primaryHover: "#1F2849",
  onPrimary: "#FAFAF8",
  presence: "#E0457B",
  line: "rgba(21, 23, 26, 0.10)",
  ink: (a: number) => `rgba(21,23,26,${a})`,
};

const DARK = {
  ground: "#121A3A",
  surface: "#1B2450",
  text: "#E6E8E3",
  muted: "#A3A8B8",
  primary: "#8E9BE0",
  primaryHover: "#A9B3EA",
  onPrimary: "#121A3A",
  presence: "#F06A96",
  line: "rgba(255,255,255,0.10)",
  ink: (a: number) => `rgba(230,232,227,${a})`,
};

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const check = () => setDark(document.documentElement.getAttribute("data-theme") === "dark");
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return dark ? DARK : LIGHT;
}

// ── Types ─────────────────────────────────────────────────────────────────
type PostType = "article" | "reflexion" | "livre" | "musique";

type Post = {
  id: string;
  user_id: string;
  type: PostType;
  content: string;
  url: string | null;
  category: string | null;
  likes_count: number | null;
  created_at: string;
  metadata?: unknown;
  profiles: {
    id: string;
    name: string | null;
    username: string;
    avatar_url: string | null;
  } | null;
};

type Profile = { name: string | null; username: string; location: string | null };

type ShelfGroup = {
  userId: string;
  name: string;
  username: string;
  posts: Post[];
  isListening: boolean;
};

const POST_SELECT = "*, profiles!posts_user_id_fkey (id, name, username, avatar_url)";

// ── Helpers ───────────────────────────────────────────────────────────────
function timeAgo(date: string) {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} j`;
  return new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" });
}

function safeUrl(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch { return null; }
}

function httpsOrNull(v: unknown) { return typeof v === "string" && v.startsWith("https://") ? v : null; }
function textOrNull(v: unknown) { return typeof v === "string" && v.trim() ? v.trim() : null; }

type ShortcutTrack = {
  title: string; artist: string | null; album: string | null;
  platform: string | null; artwork: string | null; trackUrl: string | null;
};

function parseShortcutTrack(value: unknown): ShortcutTrack | null {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  const title = textOrNull(raw?.title);
  if (!raw || !title || "embed_url" in raw) return null;
  const key = String(raw.platform ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const platform =
    key === "apple" || key === "applemusic" ? "apple-music"
    : key === "spotify" || key === "deezer" || key === "youtube" ? key
    : key === "youtubemusic" ? "youtube" : null;
  return { title, artist: textOrNull(raw.artist), album: textOrNull(raw.album), platform, artwork: httpsOrNull(raw.artwork), trackUrl: httpsOrNull(raw.trackUrl) };
}

/** Group posts by user into shelf rows */
function groupIntoShelves(posts: Post[]): ShelfGroup[] {
  const map = new Map<string, ShelfGroup>();
  for (const post of posts) {
    const existing = map.get(post.user_id);
    if (existing) {
      existing.posts.push(post);
    } else {
      map.set(post.user_id, {
        userId: post.user_id,
        name: post.profiles?.name ?? post.profiles?.username ?? "Quelqu'un",
        username: post.profiles?.username ?? "",
        posts: [post],
        isListening: false,
      });
    }
  }
  // Mark users who posted music recently as "écoute en ce moment"
  for (const shelf of map.values()) {
    const recentMusic = shelf.posts.find(
      (p) => p.type === "musique" && Date.now() - new Date(p.created_at).getTime() < 2 * 60 * 60 * 1000
    );
    if (recentMusic) shelf.isListening = true;
  }
  return [...map.values()];
}

// ── Shelf Item Components ─────────────────────────────────────────────────

/** Album/track cover item in the shelf */
function MusicShelfItem({ post, t }: { post: Post; t: typeof LIGHT }) {
  const track = parseShortcutTrack(post.metadata);
  const embed = post.type === "musique" ? parseEmbed(post.metadata) : null;
  const artwork = track?.artwork ?? embed?.artwork ?? null;
  const title = track?.title ?? embed?.title ?? post.content;
  const artist = track?.artist ?? embed?.artist ?? null;
  const url = track?.trackUrl ?? post.url;
  const [imgFailed, setImgFailed] = useState(false);

  const cover = (
    <div className="shelf-item group" style={{ width: 160, flexShrink: 0 }}>
      <div
        className="relative overflow-hidden"
        style={{ width: 160, height: 160, borderRadius: 3, background: t.surface }}
      >
        {artwork && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={artwork} alt={title} loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ fontSize: 40, color: t.ink(0.15) }}>♪</div>
        )}
        {/* Reaction avatars on cover - bottom right */}
        {(post.likes_count ?? 0) > 0 && (
          <div className="absolute bottom-1.5 right-1.5 flex" style={{ gap: -4 }}>
            <ReactionDots count={post.likes_count ?? 0} />
          </div>
        )}
      </div>
      <p className="mt-1.5 truncate" style={{ fontSize: 13, fontWeight: 500, color: t.text, fontFamily: UI_FONT }}>{title}</p>
      {artist && <p className="truncate" style={{ fontSize: 12, color: t.muted, fontFamily: UI_FONT }}>{artist}</p>}
    </div>
  );

  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block no-underline" style={{ color: "inherit" }}>
      {cover}
    </a>
  ) : cover;
}

/** Book cover item in the shelf */
function BookShelfItem({ post, t }: { post: Post; t: typeof LIGHT }) {
  const link = safeUrl(post.url);
  const [imgFailed, setImgFailed] = useState(false);
  // Try to extract image from metadata or OG
  const meta = post.metadata as Record<string, unknown> | undefined;
  const cover = httpsOrNull(meta?.cover_url) ?? httpsOrNull(meta?.image);

  const content = (
    <div className="shelf-item" style={{ width: 120, flexShrink: 0 }}>
      <div
        className="relative overflow-hidden"
        style={{ width: 120, height: 170, borderRadius: 3, background: t.surface }}
      >
        {cover && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={cover} alt={post.content} loading="lazy"
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-3 text-center" style={{ background: t.surface }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: t.text, fontFamily: UI_FONT, lineHeight: 1.3 }}>{post.content.slice(0, 60)}</span>
          </div>
        )}
        {(post.likes_count ?? 0) > 0 && (
          <div className="absolute bottom-1.5 right-1.5 flex">
            <ReactionDots count={post.likes_count ?? 0} />
          </div>
        )}
      </div>
      <p className="mt-1.5 truncate" style={{ fontSize: 12, fontWeight: 500, color: t.text, fontFamily: UI_FONT }}>
        {post.content.split(" — ")[0]?.slice(0, 40)}
      </p>
      {post.content.includes(" — ") && (
        <p className="truncate" style={{ fontSize: 11, color: t.muted, fontFamily: UI_FONT }}>
          {post.content.split(" — ")[1]}
        </p>
      )}
    </div>
  );

  return link ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className="block no-underline" style={{ color: "inherit" }}>
      {content}
    </a>
  ) : content;
}

/** Article card in the shelf — styled like the Philosophie Magazine card in the mockup */
function ArticleShelfItem({ post, t }: { post: Post; t: typeof LIGHT }) {
  const link = safeUrl(post.url);
  const comment = post.content;
  const meta = post.metadata as Record<string, unknown> | undefined;
  const siteName = textOrNull(meta?.siteName) ?? textOrNull(meta?.domain);
  const readTime = meta?.readTime ? `${meta.readTime} min` : null;

  const card = (
    <div className="shelf-item" style={{ width: 180, flexShrink: 0 }}>
      <div
        className="flex flex-col justify-between"
        style={{
          width: 180, height: 170, borderRadius: 3,
          background: t.surface,
          padding: 16,
          border: `1px solid ${t.line}`,
        }}
      >
        <div>
          {siteName && (
            <p style={{ fontSize: 11, color: t.muted, fontFamily: UI_FONT, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.03em" }}>
              {siteName}
            </p>
          )}
          <p style={{ fontSize: 14, fontWeight: 600, color: t.text, fontFamily: UI_FONT, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
            {comment.slice(0, 100)}
          </p>
        </div>
        <div>
          {readTime && <p style={{ fontSize: 11, color: t.muted, fontFamily: "JetBrains Mono, monospace" }}>{readTime}</p>}
        </div>
      </div>
      {post.category && (
        <p className="mt-1.5 truncate" style={{ fontSize: 11, color: t.muted, fontFamily: UI_FONT }}>
          {post.category}
        </p>
      )}
    </div>
  );

  return link ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className="block no-underline" style={{ color: "inherit" }}>
      {card}
    </a>
  ) : card;
}

/** Quote/reflexion card in the shelf — italic text block */
function QuoteShelfItem({ post, t }: { post: Post; t: typeof LIGHT }) {
  return (
    <div className="shelf-item" style={{ width: 180, flexShrink: 0 }}>
      <div
        className="flex items-start"
        style={{
          width: 180, height: 170, borderRadius: 3,
          background: t.surface,
          padding: 16,
          border: `1px solid ${t.line}`,
        }}
      >
        <p style={{
          fontSize: 15, color: t.text, fontFamily: READING_FONT,
          fontWeight: 400, lineHeight: 1.55, fontStyle: "italic",
          display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          « {post.content.slice(0, 180)} »
        </p>
      </div>
      {post.category && (
        <p className="mt-1.5" style={{ fontSize: 11, color: t.muted, fontFamily: UI_FONT }}>
          Réflexion · {post.category}
        </p>
      )}
    </div>
  );
}

function ReactionDots({ count }: { count: number }) {
  const colors = ["#E0457B", "#8E9BE0", "#2F7D5B", "#A86A12"];
  const shown = Math.min(count, 3);
  return (
    <span className="flex" style={{ gap: 0 }}>
      {Array.from({ length: shown }, (_, i) => (
        <span key={i} style={{
          width: 18, height: 18, borderRadius: "50%",
          background: colors[i % colors.length],
          border: "2px solid white",
          marginLeft: i > 0 ? -6 : 0,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 8, color: "white", fontWeight: 600,
        }}>
          {i === 0 ? "♥" : ""}
        </span>
      ))}
    </span>
  );
}

// ── Shelf row for one person ──────────────────────────────────────────────
function PersonShelf({ shelf, t }: { shelf: ShelfGroup; t: typeof LIGHT }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const count = shelf.posts.length;
  const subtitle = shelf.isListening
    ? "écoute en ce moment"
    : `${count} ${count > 1 ? "choses" : "chose"} cette semaine`;

  return (
    <section style={{ marginBottom: 48 }}>
      {/* Header */}
      <div className="flex items-baseline justify-between" style={{ marginBottom: 16, borderBottom: `1px solid ${t.line}`, paddingBottom: 12 }}>
        <div className="flex items-baseline" style={{ gap: 12 }}>
          <h2 style={{ fontSize: 28, fontWeight: 800, color: t.text, fontFamily: DISPLAY_FONT, letterSpacing: "-0.02em" }}>
            {shelf.name.split(" ")[0]}
          </h2>
          <span style={{ fontSize: 14, color: t.muted, fontFamily: UI_FONT }}>{subtitle}</span>
        </div>
        <Link
          href={`/profile?id=${shelf.userId}`}
          style={{ fontSize: 13, color: t.primary, fontFamily: UI_FONT, textDecoration: "none" }}
          className="hover:underline"
        >
          Son étagère →
        </Link>
      </div>

      {/* Horizontal scroll of items */}
      <div
        ref={scrollRef}
        className="shelf-scroll flex overflow-x-auto"
        style={{ gap: 16, paddingBottom: 8 }}
      >
        {shelf.posts.map((post) => {
          if (post.type === "musique") return <MusicShelfItem key={post.id} post={post} t={t} />;
          if (post.type === "livre") return <BookShelfItem key={post.id} post={post} t={t} />;
          if (post.type === "reflexion") return <QuoteShelfItem key={post.id} post={post} t={t} />;
          return <ArticleShelfItem key={post.id} post={post} t={t} />;
        })}
      </div>
    </section>
  );
}

// ── Full reflexion post (standalone, below shelves) ───────────────────────
function ReflexionPost({ post, t }: { post: Post; t: typeof LIGHT }) {
  const author = post.profiles;
  const tone = avatarTones[(post.user_id.charCodeAt(0) + post.user_id.charCodeAt(1)) % avatarTones.length];

  return (
    <article style={{
      background: t.surface,
      borderRadius: 6,
      padding: 24,
      marginBottom: 24,
      border: `1px solid ${t.line}`,
    }}>
      <div className="flex items-center" style={{ gap: 10, marginBottom: 16 }}>
        <span
          className="flex shrink-0 items-center justify-center"
          style={{ width: 32, height: 32, borderRadius: "50%", background: tone.background, color: tone.color, fontSize: 12, fontWeight: 500 }}
        >
          {getInitials(author?.name ?? null, author?.username)}
        </span>
        <span style={{ fontSize: 14, color: t.text, fontFamily: UI_FONT }}>
          <strong>{author?.name ?? author?.username}</strong>
          <span style={{ color: t.muted }}> partage une réflexion</span>
        </span>
        <span className="ml-auto" style={{ fontSize: 12, color: t.muted, fontFamily: "JetBrains Mono, monospace" }}>
          il y a {timeAgo(post.created_at)}
        </span>
      </div>
      <p style={{
        fontSize: 18, color: t.text, fontFamily: READING_FONT,
        lineHeight: 1.55, fontWeight: 400,
      }}>
        {post.content}
      </p>
      <div className="mt-4">
        <SocialActions postId={post.id} likes={post.likes_count ?? 0} comments={0} extra="Répondre" />
      </div>
    </article>
  );
}

// ── Follow suggestion card ────────────────────────────────────────────────
function FollowPromptCard({ t, userId }: { t: typeof LIGHT; userId: string | undefined }) {
  const [suggestions, setSuggestions] = useState<{ id: string; name: string | null; username: string }[]>([]);
  const [followedSet, setFollowedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getSuggested(userId, 3).then((results) => {
      if (!cancelled) setSuggestions(results.map((p) => ({ id: p.id, name: p.name, username: p.username })));
    });
    return () => { cancelled = true; };
  }, [userId]);

  const handleFollow = async (targetId: string) => {
    if (!userId) return;
    const ok = await followUser(userId, targetId);
    if (ok) setFollowedSet((prev) => new Set(prev).add(targetId));
  };

  return (
    <div style={{
      background: t.surface,
      borderRadius: 6,
      padding: 24,
      border: `1px solid ${t.line}`,
    }}>
      <h3 style={{ fontSize: 22, fontWeight: 800, color: t.text, fontFamily: DISPLAY_FONT, letterSpacing: "-0.02em" }}>
        Personne à suivre ?
      </h3>
      <p className="mt-2" style={{ fontSize: 14, color: t.muted, fontFamily: UI_FONT, lineHeight: 1.5 }}>
        Ton étagère est vide pour l&apos;instant.<br />
        Partage un premier morceau ou découvre qui suivre.
      </p>
      <div className="mt-4 flex" style={{ gap: 12 }}>
        <button
          type="button"
          onClick={() => document.getElementById("shelf-compose-trigger")?.click()}
          style={{
            background: t.primary, color: t.onPrimary,
            fontSize: 13, fontWeight: 500, fontFamily: UI_FONT,
            padding: "10px 20px", borderRadius: 6, border: "none", cursor: "pointer",
          }}
        >
          Partager un morceau
        </button>
        <Link
          href="/explore"
          style={{
            fontSize: 13, fontWeight: 500, fontFamily: UI_FONT,
            color: t.primary, padding: "10px 20px", borderRadius: 6,
            border: `1px solid ${t.line}`, textDecoration: "none",
            display: "flex", alignItems: "center",
          }}
        >
          Explorer
        </Link>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-6 flex flex-col" style={{ gap: 10 }}>
          {suggestions.map((s) => {
            const displayName = s.name ?? s.username;
            const tone = avatarTones[(displayName.charCodeAt(0) + (displayName.charCodeAt(1) || 0)) % avatarTones.length];
            const followed = followedSet.has(s.id);
            return (
              <div key={s.id} className="flex items-center" style={{ gap: 10 }}>
                <span
                  className="flex shrink-0 items-center justify-center"
                  style={{ width: 32, height: 32, borderRadius: "50%", background: tone.background, color: tone.color, fontSize: 11, fontWeight: 500 }}
                >
                  {getInitials(s.name, s.username)}
                </span>
                <span style={{ fontSize: 13, color: t.text, fontFamily: UI_FONT, flex: 1 }}>{displayName}</span>
                {followed ? (
                  <span style={{ fontSize: 11, color: t.muted, fontFamily: UI_FONT }}>Suivi ✓</span>
                ) : (
                  <button type="button" onClick={() => handleFollow(s.id)}
                    style={{ fontSize: 11, color: t.primary, background: "none", border: `1px solid ${t.line}`, borderRadius: 4, padding: "4px 12px", cursor: "pointer", fontFamily: UI_FONT }}>
                    Suivre
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Compose modal (simplified) ────────────────────────────────────────────
const postTypes: { value: PostType; label: string }[] = [
  { value: "musique", label: "Musique" },
  { value: "article", label: "Article" },
  { value: "livre", label: "Livre" },
  { value: "reflexion", label: "Réflexion" },
];

const categories = [
  "Géopolitique", "Histoire", "Science", "Art", "Musique", "Littérature", "Tech",
];

function ComposeModal({ user, onClose, onCreated, t }: { user: User; onClose: () => void; onCreated: () => void; t: typeof LIGHT }) {
  const [type, setType] = useState<PostType>("musique");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [musicEmbed, setMusicEmbed] = useState<MusicEmbed | null>(null);
  const [musicLoading, setMusicLoading] = useState(false);
  const [lookedUp, setLookedUp] = useState("");

  const lookUpMusic = async (value: string) => {
    const link = value.trim();
    if (!link || link === lookedUp) return;
    setLookedUp(link);
    setMusicLoading(true);
    try { setMusicEmbed(await fetchEmbed(link)); } catch { setMusicEmbed(null); } finally { setMusicLoading(false); }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (type === "musique" && !musicEmbed) { setError("Ajoute un lien reconnu."); return; }
    const trimmedUrl = (type === "article" || type === "musique") ? url.trim() : "";
    if (trimmedUrl && !safeUrl(trimmedUrl)) { setError("Le lien doit commencer par http:// ou https://"); return; }
    setSubmitting(true);
    const profileError = await ensureProfile(user);
    if (profileError) { setError(profileError); setSubmitting(false); return; }
    const post: Record<string, unknown> = { user_id: user.id, type, content: content.trim() || (type === "musique" && musicEmbed ? musicEmbed.title : ""), url: trimmedUrl || null, category };
    let { error: insertError } = await supabase.from("posts").insert(type === "musique" ? { ...post, metadata: musicEmbed } : post);
    if (insertError && type === "musique" && /metadata/i.test(insertError.message)) {
      ({ error: insertError } = await supabase.from("posts").insert(post));
    }
    if (insertError) { setError(insertError.message); setSubmitting(false); return; }
    onCreated();
  };

  const fieldStyle: CSSProperties = { background: t.surface, border: `1px solid ${t.line}`, borderRadius: 4, color: t.text, outline: "none", width: "100%", fontFamily: UI_FONT };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}
        className="w-full" style={{ maxWidth: 480, background: t.ground, borderRadius: 8, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between">
          <h2 style={{ fontSize: 18, fontWeight: 800, color: t.text, fontFamily: DISPLAY_FONT }}>Nouveau post</h2>
          <button type="button" onClick={onClose} style={{ fontSize: 18, color: t.muted, background: "none", border: "none", cursor: "pointer" }}>✕</button>
        </div>

        <div className="mt-4 flex" style={{ gap: 8 }}>
          {postTypes.map((item) => (
            <button key={item.value} type="button" onClick={() => setType(item.value)}
              style={{
                fontSize: 12, padding: "6px 14px", borderRadius: 4, cursor: "pointer",
                fontFamily: UI_FONT, border: "none",
                ...(type === item.value
                  ? { background: t.primary, color: t.onPrimary }
                  : { background: t.surface, color: t.muted }),
              }}>
              {item.label}
            </button>
          ))}
        </div>

        {(type === "article" || type === "musique") && (
          <input type="url" value={url} onChange={(e) => setUrl(e.target.value)}
            onBlur={(e) => type === "musique" && lookUpMusic(e.currentTarget.value)}
            placeholder={type === "musique" ? "Lien Spotify, Apple Music, Deezer..." : "URL de l'article"}
            className="mt-3 block" style={{ ...fieldStyle, padding: "10px 14px", fontSize: 13 }} />
        )}

        {type === "musique" && musicLoading && <p className="mt-2" style={{ fontSize: 11, color: t.muted }}>Recherche…</p>}
        {type === "musique" && musicEmbed && <div className="mt-2"><MusicCard embed={musicEmbed} href={url.trim()} /></div>}

        <textarea value={content} onChange={(e) => setContent(e.target.value)}
          placeholder={type === "reflexion" ? "Ta réflexion..." : "Un commentaire..."}
          rows={3} className="mt-3 block resize-none" style={{ ...fieldStyle, padding: "12px 14px", fontSize: 14, lineHeight: 1.5, fontFamily: type === "reflexion" ? READING_FONT : UI_FONT }} />

        <div className="mt-3 flex flex-wrap" style={{ gap: 6 }}>
          {categories.map((cat) => (
            <button key={cat} type="button" onClick={() => setCategory(category === cat ? null : cat)}
              style={{
                fontSize: 11, padding: "3px 10px", borderRadius: 4, cursor: "pointer",
                fontFamily: UI_FONT, border: `1px solid ${t.line}`,
                ...(category === cat ? { background: t.primary, color: t.onPrimary, borderColor: t.primary } : { background: "transparent", color: t.muted }),
              }}>
              {cat}
            </button>
          ))}
        </div>

        {error && <p className="mt-3" style={{ fontSize: 12, color: "#B4302F" }}>{error}</p>}

        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={(type === "musique" ? !musicEmbed : !content.trim()) || submitting}
            style={{
              background: t.primary, color: t.onPrimary,
              fontSize: 13, fontWeight: 500, fontFamily: UI_FONT,
              padding: "10px 24px", borderRadius: 6, border: "none", cursor: "pointer",
              opacity: submitting ? 0.6 : 1,
            }}>
            {submitting ? "Publication…" : "Publier"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const router = useRouter();
  const t = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [mine, setMine] = useState<Record<string, MyInteractions>>({});
  const [following, setFollowing] = useState<PublicProfile[]>([]);

  const css = `
    @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&f[]=cabinet-grotesk@800&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=Literata:ital,wght@0,400;1,400&family=JetBrains+Mono:wght@400&display=swap');
    .shelf-scroll { scrollbar-width: none; }
    .shelf-scroll::-webkit-scrollbar { display: none; }
    .shelf-item { transition: transform 0.15s ease; }
    .shelf-item:hover { transform: translateY(-2px); }
    ${socialCss}
  `;

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setSession(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => { setSession(s); });
    return () => subscription.unsubscribe();
  }, [router]);

  const user = session?.user;
  const userId = user?.id;

  const loadPosts = useCallback(async () => {
    setFeedError(null);
    const { data: auth } = await supabase.auth.getSession();
    const token = auth.session?.access_token;
    let loaded: Post[] | null = null;

    if (token) {
      try {
        const res = await fetch("/api/feed", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) loaded = (await res.json()) as Post[];
      } catch { /* fall back */ }
    }

    if (!loaded) {
      const { data, error } = await supabase
        .from("posts").select(POST_SELECT)
        .not("content", "ilike", "%Morceau actuel%")
        .not("content", "ilike", "%Test du Raccourci%")
        .order("created_at", { ascending: false }).limit(40);
      if (error) { setFeedError(error.message); return; }
      loaded = data as Post[];
    }

    const viewerId = auth.session?.user.id;
    const byPost: Record<string, MyInteractions> = {};
    if (viewerId && loaded.length > 0) {
      const { data: rows } = await supabase.from("interactions").select("post_id, type, content").eq("user_id", viewerId).in("post_id", loaded.map((p) => p.id));
      for (const row of rows ?? []) {
        const entry = (byPost[row.post_id] ??= { like: false, reaction: null, comment: null });
        if (row.type === "like") entry.like = true;
        else if (row.type === "reaction") entry.reaction = row.content;
        else if (row.type === "comment") entry.comment = row.content;
      }
    }
    setMine(byPost);
    setPosts(loaded);
  }, []);

  useEffect(() => {
    if (!userId) return;
    loadPosts();
    let cancelled = false;
    (async () => {
      const error = user ? await ensureProfile(user) : null;
      if (cancelled) return;
      if (!error) void claimReferral(userId);
      const { data } = await supabase.from("profiles").select("name, username, location").eq("id", userId).maybeSingle();
      if (!cancelled) setProfile(data);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loadPosts]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getFollowing(userId).then((list) => { if (!cancelled) setFollowing(list); });
    return () => { cancelled = true; };
  }, [userId]);

  const closeModal = useCallback(() => setModalOpen(false), []);

  // Group posts into shelves
  const shelves = useMemo(() => posts ? groupIntoShelves(posts) : [], [posts]);
  // Standalone reflexions (longer posts shown as full cards below shelves)
  const standAloneReflexions = useMemo(
    () => (posts ?? []).filter((p) => p.type === "reflexion" && p.content.length > 80),
    [posts]
  );

  if (!session) return <div className="min-h-screen" style={{ background: t.ground }} />;

  const email = session.user.email;
  const displayName = profile?.name ?? email?.split("@")[0] ?? "";
  const initials = getInitials(profile?.name ?? null, email);
  const tone = avatarTones[(displayName.charCodeAt(0) + (displayName.charCodeAt(1) || 0)) % avatarTones.length];

  const hasPosts = (posts?.length ?? 0) > 0;

  return (
    <SocialContext.Provider value={{ user: session.user, viewerName: profile?.name ?? null, mine }}>
      <div className="min-h-screen" style={{ background: t.ground, color: t.text, fontFamily: UI_FONT }}>
        <style>{css}</style>

        {/* Top nav — clean like the mockup */}
        <header className="flex items-center justify-between" style={{ padding: "16px 24px", maxWidth: 1200, margin: "0 auto" }}>
          <div className="flex items-center" style={{ gap: 24 }}>
            <Link href="/dashboard" style={{ fontSize: 20, fontWeight: 800, color: t.text, fontFamily: DISPLAY_FONT, textDecoration: "none", letterSpacing: "-0.02em" }}>
              boredboard
            </Link>
            <nav className="hidden items-center sm:flex" style={{ gap: 20 }}>
              <Link href="/dashboard" style={{ fontSize: 14, fontWeight: 500, color: t.text, fontFamily: UI_FONT, textDecoration: "none" }}>
                Board
              </Link>
              <Link href="/explore" style={{ fontSize: 14, color: t.muted, fontFamily: UI_FONT, textDecoration: "none" }}>
                Explorer
              </Link>
            </nav>
          </div>
          <div className="flex items-center" style={{ gap: 12 }}>
            <button
              id="shelf-compose-trigger"
              type="button"
              onClick={() => setModalOpen(true)}
              style={{
                background: t.primary, color: t.onPrimary,
                fontSize: 13, fontWeight: 500, fontFamily: UI_FONT,
                padding: "8px 16px", borderRadius: 6, border: "none", cursor: "pointer",
              }}
            >
              + Partager
            </button>
            <Link
              href="/profile"
              className="flex shrink-0 items-center justify-center"
              style={{
                width: 36, height: 36, borderRadius: "50%",
                background: t.primary, color: t.onPrimary,
                fontSize: 13, fontWeight: 500, textDecoration: "none",
              }}
            >
              {initials}
            </Link>
          </div>
        </header>

        {/* Main content */}
        <main style={{ maxWidth: 1200, margin: "0 auto", padding: "24px 24px 96px" }}>
          {feedError ? (
            <div className="text-center" style={{ padding: "60px 20px" }}>
              <p style={{ fontSize: 15, fontWeight: 500, color: t.text }}>Impossible de charger le feed</p>
              <p className="mt-2" style={{ fontSize: 12, color: "#B4302F" }}>{feedError}</p>
              <button type="button" onClick={loadPosts} className="mt-4"
                style={{ fontSize: 12, padding: "8px 20px", borderRadius: 4, border: `1px solid ${t.line}`, color: t.muted, background: "none", cursor: "pointer" }}>
                Réessayer
              </button>
            </div>
          ) : posts === null ? (
            /* Loading skeleton */
            <div>
              {[0, 1, 2].map((i) => (
                <div key={i} className="animate-pulse" style={{ marginBottom: 48 }}>
                  <div className="flex items-baseline" style={{ gap: 12, marginBottom: 16 }}>
                    <div style={{ width: 120, height: 28, background: t.surface, borderRadius: 4 }} />
                    <div style={{ width: 160, height: 14, background: t.surface, borderRadius: 4 }} />
                  </div>
                  <div className="flex" style={{ gap: 16 }}>
                    {[0, 1, 2, 3].map((j) => (
                      <div key={j} style={{ width: 160, height: 160, background: t.surface, borderRadius: 3, flexShrink: 0 }} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : !hasPosts ? (
            /* Empty state */
            <div className="grid gap-8 md:grid-cols-[2fr_1fr]" style={{ marginTop: 32 }}>
              <div>
                <h1 style={{ fontSize: 34, fontWeight: 800, color: t.text, fontFamily: DISPLAY_FONT, letterSpacing: "-0.02em", lineHeight: 1.15 }}>
                  Ton étagère est vide pour l&apos;instant.
                </h1>
                <p className="mt-3" style={{ fontSize: 15, color: t.muted, fontFamily: UI_FONT, lineHeight: 1.5, maxWidth: 460 }}>
                  Partage un morceau depuis Apple Music ou Spotify, un article, le livre que tu as sur ta table de nuit. Tes amis voient ton étagère, tu vois la leur.
                </p>
                <div className="mt-6 flex" style={{ gap: 12 }}>
                  <button type="button" onClick={() => setModalOpen(true)}
                    style={{ background: t.primary, color: t.onPrimary, fontSize: 14, fontWeight: 500, fontFamily: UI_FONT, padding: "12px 24px", borderRadius: 6, border: "none", cursor: "pointer" }}>
                    Créer mon étagère
                  </button>
                  <Link href="/explore"
                    style={{ fontSize: 14, fontFamily: UI_FONT, color: t.text, padding: "12px 24px", borderRadius: 6, border: `1px solid ${t.line}`, textDecoration: "none" }}>
                    Voir une étagère d&apos;exemple
                  </Link>
                </div>
              </div>
              <FollowPromptCard t={t} userId={userId} />
            </div>
          ) : (
            /* Shelves */
            <div className="grid gap-0 md:grid-cols-[1fr_300px] md:gap-12">
              <div>
                {shelves.map((shelf) => (
                  <PersonShelf key={shelf.userId} shelf={shelf} t={t} />
                ))}

                {/* Standalone reflexion posts below shelves */}
                {standAloneReflexions.length > 0 && (
                  <div style={{ marginTop: 24 }}>
                    {standAloneReflexions.map((post) => (
                      <ReflexionPost key={post.id} post={post} t={t} />
                    ))}
                  </div>
                )}
              </div>

              {/* Right column — follow prompt */}
              <aside className="hidden md:block" style={{ paddingTop: 8 }}>
                <FollowPromptCard t={t} userId={userId} />
              </aside>
            </div>
          )}
        </main>

        {modalOpen && <ComposeModal user={session.user} onClose={closeModal} onCreated={() => { setModalOpen(false); loadPosts(); }} t={t} />}
      </div>
    </SocialContext.Provider>
  );
}

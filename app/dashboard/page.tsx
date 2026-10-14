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
import type { Session, User } from "@supabase/supabase-js";
import { getInitials } from "@/components/Navbar";
import SharedMusicCard from "@/components/MusicCard";
import SocialActions, { SocialContext, socialCss, type MyInteractions } from "@/components/dashboard/SocialActions";
import { fetchEmbed, parseEmbed, type MusicEmbed } from "@/lib/music";
import { ensureProfile } from "@/lib/profile";
import { claimReferral } from "@/lib/referral";
import { avatarTones } from "@/lib/sample-data";
import { getFollowing, getSuggested, follow as followUser, type PublicProfile } from "@/lib/social";
import { supabase } from "@/lib/supabase";

// ── Design tokens ─────────────────────────────────────────────────────────
const DISPLAY = "'Cabinet Grotesk', system-ui, sans-serif";
const UI = "Satoshi, system-ui, sans-serif";
const READING = "Literata, Georgia, serif";
const MONO = "'JetBrains Mono', monospace";
const HERO_SERIF = "'DM Serif Display', Literata, Georgia, serif";

const LIGHT = {
  ground: "#ECEEEA", surface: "#FAFAF8", text: "#15171A",
  muted: "#5D6168", primary: "#2A3560", onPrimary: "#FAFAF8",
  line: "rgba(21,23,26,0.10)",
  ink: (a: number) => `rgba(21,23,26,${a})`,
};

const DARK = {
  ground: "#121A3A", surface: "#1B2450", text: "#E6E8E3",
  muted: "#A3A8B8", primary: "#8E9BE0", onPrimary: "#121A3A",
  line: "rgba(255,255,255,0.10)",
  ink: (a: number) => `rgba(230,232,227,${a})`,
};

function useTheme() {
  const [dark, setDark] = useState(true);
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bb-theme");
      if (saved === "light") setDark(false);
    } catch {}
  }, []);
  const toggle = useCallback(() => {
    setDark((prev) => {
      const next = !prev;
      try { localStorage.setItem("bb-theme", next ? "dark" : "light"); } catch {}
      return next;
    });
  }, []);
  return { t: dark ? DARK : LIGHT, dark, toggle };
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
type OgData = { title: string | null; description: string | null; image: string | null; domain: string | null; siteName: string | null };

const POST_SELECT = "*, profiles!posts_user_id_fkey (id, name, username, avatar_url)";

// ── Helpers ───────────────────────────────────────────────────────────────
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

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "maintenant";
  if (mins < 60) return `${mins}min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}j`;
  return `${Math.floor(days / 7)}sem`;
}

const postTypes: { value: PostType; label: string }[] = [
  { value: "musique", label: "Musique" },
  { value: "article", label: "Article" },
  { value: "livre", label: "Livre" },
  { value: "reflexion", label: "Réflexion" },
];

const categoryList = ["Géopolitique", "Histoire", "Science", "Art", "Musique", "Littérature", "Tech"];

// ── Tabs ──────────────────────────────────────────────────────────────────
type FeedTab = "tout" | "musique" | "livre" | "article" | "reflexion";
const TABS: { value: FeedTab; label: string; icon: string }[] = [
  { value: "tout", label: "Tout", icon: "✨" },
  { value: "musique", label: "Musique", icon: "♫" },
  { value: "livre", label: "Livres", icon: "📚" },
  { value: "article", label: "Articles", icon: "📰" },
  { value: "reflexion", label: "Réflexions", icon: "💭" },
];

// ── OG Preview hook ───────────────────────────────────────────────────────
function useOgPreview(url: string | null) {
  const [og, setOg] = useState<OgData | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    supabase.auth.getSession()
      .then(({ data }) => {
        const token = data.session?.access_token;
        if (!token) return null;
        return fetch(`/api/og?url=${encodeURIComponent(url)}`, { headers: { Authorization: `Bearer ${token}` } });
      })
      .then((r) => r?.ok ? r.json() : null)
      .then((data) => { if (!cancelled && data) setOg(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url]);
  return og;
}

// ── Avatar ────────────────────────────────────────────────────────────────
function Avatar({ initials, size, background, color }: { initials: string; size: number; background: string; color: string }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, background, color, borderRadius: "50%", fontSize: Math.max(9, size * 0.36), fontWeight: 500, fontFamily: UI }}
    >
      {initials}
    </span>
  );
}

// ── Post type badges ─────────────────────────────────────────────────────
function TypeBadge({ type, t }: { type: PostType; t: typeof LIGHT }) {
  const cfg: Record<PostType, { label: string; icon: string; bg: string }> = {
    musique: { label: "Musique", icon: "♫", bg: "rgba(142,155,224,0.15)" },
    livre: { label: "Livre", icon: "📚", bg: "rgba(196,169,74,0.15)" },
    article: { label: "Article", icon: "📰", bg: "rgba(22,163,74,0.15)" },
    reflexion: { label: "Réflexion", icon: "💭", bg: "rgba(212,83,126,0.15)" },
  };
  const c = cfg[type];
  return (
    <span style={{
      fontSize: 11, fontFamily: UI, fontWeight: 500,
      padding: "3px 10px", borderRadius: 20,
      background: c.bg, color: t.text,
      display: "inline-flex", alignItems: "center", gap: 4,
    }}>
      {c.icon} {c.label}
    </span>
  );
}

// ── Individual feed cards per type ───────────────────────────────────────

function MusicFeedCard({ post, t }: { post: Post; t: typeof LIGHT }) {
  const track = parseShortcutTrack(post.metadata);
  const embed = post.type === "musique" ? parseEmbed(post.metadata) : null;
  const artwork = track?.artwork ?? embed?.thumbnail ?? null;
  const title = track?.title ?? embed?.title ?? post.content;
  const artist = track?.artist ?? embed?.artist ?? null;
  const url = track?.trackUrl ?? post.url;
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div className="flex" style={{ gap: 16 }}>
      {/* Album art */}
      <div style={{ width: 120, height: 120, borderRadius: 10, overflow: "hidden", background: t.surface, flexShrink: 0 }}>
        {artwork && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artwork} alt={title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgFailed(true)} />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ fontSize: 36, color: t.ink(0.12) }}>&#9835;</div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p style={{ fontSize: 17, fontWeight: 600, color: t.text, fontFamily: UI, lineHeight: 1.3 }}>{title}</p>
        {artist && <p style={{ fontSize: 14, color: t.muted, fontFamily: UI, marginTop: 2 }}>{artist}</p>}
        {url && (
          <a href={url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: t.primary, fontFamily: UI, marginTop: 8, textDecoration: "none" }}>
            &Eacute;couter &rarr;
          </a>
        )}
      </div>
    </div>
  );
}

function BookFeedCard({ post, t }: { post: Post; t: typeof LIGHT }) {
  const link = safeUrl(post.url);
  const [imgFailed, setImgFailed] = useState(false);
  const meta = post.metadata as Record<string, unknown> | undefined;
  const coverImg = httpsOrNull(meta?.cover_url) ?? httpsOrNull(meta?.image);
  const parts = post.content.split(" — ");
  const bookTitle = parts[0]?.slice(0, 80) ?? post.content.slice(0, 80);
  const author = parts[1] ?? null;

  return (
    <div className="flex" style={{ gap: 16 }}>
      <div style={{ width: 90, height: 130, borderRadius: 6, overflow: "hidden", background: t.surface, flexShrink: 0 }}>
        {coverImg && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImg} alt={bookTitle} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgFailed(true)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-2 text-center" style={{ background: t.surface }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: t.text, fontFamily: UI }}>{bookTitle}</span>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center">
        <p style={{ fontSize: 17, fontWeight: 600, color: t.text, fontFamily: UI, lineHeight: 1.3 }}>{bookTitle}</p>
        {author && <p style={{ fontSize: 14, color: t.muted, fontFamily: UI, marginTop: 2 }}>{author}</p>}
        {link && (
          <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: t.primary, fontFamily: UI, marginTop: 8, textDecoration: "none" }}>
            Voir le livre &rarr;
          </a>
        )}
      </div>
    </div>
  );
}

function ArticleFeedCard({ post, t }: { post: Post; t: typeof LIGHT }) {
  const link = safeUrl(post.url);
  const og = useOgPreview(post.url);
  const ogImage = og?.image ?? null;
  const siteName = og?.siteName ?? og?.domain ?? null;
  const ogTitle = og?.title ?? null;
  const displayTitle = ogTitle ?? post.content.slice(0, 120);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div>
      {ogImage && !imgFailed && (
        <div style={{ marginBottom: 12, borderRadius: 10, overflow: "hidden", maxHeight: 200 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ogImage} alt="" loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} onError={() => setImgFailed(true)} />
        </div>
      )}
      {siteName && (
        <p style={{ fontSize: 11, color: t.muted, fontFamily: MONO, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.04em" }}>{siteName}</p>
      )}
      <p style={{ fontSize: 17, fontWeight: 600, color: t.text, fontFamily: UI, lineHeight: 1.35 }}>{displayTitle}</p>
      {og?.description && (
        <p style={{ fontSize: 13, color: t.muted, fontFamily: UI, lineHeight: 1.5, marginTop: 6, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
          {og.description}
        </p>
      )}
      {link && (
        <a href={link.href} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: t.primary, fontFamily: UI, marginTop: 8, display: "inline-block", textDecoration: "none" }}>
          Lire l&apos;article &rarr;
        </a>
      )}
    </div>
  );
}

function ReflexionFeedCard({ post, t }: { post: Post; t: typeof LIGHT }) {
  return (
    <div>
      <blockquote style={{
        fontSize: 17, color: t.text, fontFamily: READING,
        fontStyle: "italic", lineHeight: 1.6,
        borderLeft: `3px solid ${t.primary}`,
        paddingLeft: 16, margin: 0,
      }}>
        {post.content}
      </blockquote>
      {post.category && (
        <p style={{ fontSize: 11, color: t.muted, fontFamily: UI, marginTop: 10 }}>{post.category}</p>
      )}
    </div>
  );
}

// ── Social feed post wrapper ─────────────────────────────────────────────
function FeedPost({ post, t }: { post: Post; t: typeof LIGHT }) {
  const tone = avatarTones[((post.user_id?.charCodeAt(0) ?? 0) + (post.user_id?.charCodeAt(1) ?? 0)) % avatarTones.length];
  const authorName = post.profiles?.name ?? post.profiles?.username ?? "Quelqu'un";
  const authorUsername = post.profiles?.username ?? "";

  return (
    <article style={{
      background: t.surface,
      borderRadius: 16,
      padding: "20px 24px",
      border: `1px solid ${t.line}`,
    }}>
      {/* Author header */}
      <div className="flex items-center justify-between" style={{ marginBottom: 14 }}>
        <Link href={`/profile?id=${post.user_id}`} className="flex items-center" style={{ gap: 10, textDecoration: "none" }}>
          <Avatar initials={getInitials(post.profiles?.name ?? null, authorUsername)} size={38} {...tone} />
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: t.text, fontFamily: UI, lineHeight: 1.2 }}>{authorName}</p>
            <p style={{ fontSize: 12, color: t.muted, fontFamily: UI }}>
              @{authorUsername} &middot; {timeAgo(post.created_at)}
            </p>
          </div>
        </Link>
        <TypeBadge type={post.type} t={t} />
      </div>

      {/* Content by type */}
      {post.type === "musique" && <MusicFeedCard post={post} t={t} />}
      {post.type === "livre" && <BookFeedCard post={post} t={t} />}
      {post.type === "article" && <ArticleFeedCard post={post} t={t} />}
      {post.type === "reflexion" && <ReflexionFeedCard post={post} t={t} />}

      {/* Social actions */}
      <SocialActions
        likes={post.likes_count ?? 0}
        comments={0}
        postId={post.id}
      />
    </article>
  );
}

// ── Compose modal ─────────────────────────────────────────────────────────
function NewPostModal({ user, onClose, onCreated, t }: { user: User; onClose: () => void; onCreated: () => void; t: typeof LIGHT }) {
  const [type, setType] = useState<PostType>("musique");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [musicEmbed, setMusicEmbed] = useState<MusicEmbed | null>(null);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState(false);
  const [lookedUp, setLookedUp] = useState("");
  const ogPreview = useOgPreview(type === "article" && url.trim() ? url.trim() : null);

  const lookUpMusic = async (value: string) => {
    const link = value.trim();
    if (!link || link === lookedUp) return;
    setLookedUp(link);
    setMusicLoading(true);
    setMusicError(false);
    try { setMusicEmbed(await fetchEmbed(link)); } catch { setMusicEmbed(null); setMusicError(true); } finally { setMusicLoading(false); }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (type === "musique" && !musicEmbed) { setError("Ajoute un lien Spotify, Apple Music, Deezer, SoundCloud ou YouTube reconnu."); return; }
    const trimmedUrl = (type === "article" || type === "musique") ? url.trim() : "";
    if (trimmedUrl && !safeUrl(trimmedUrl)) { setError("Le lien doit commencer par http:// ou https://"); return; }
    setSubmitting(true);
    const profileError = await ensureProfile(user);
    if (profileError) { setError(`Ton profil n'a pas pu être créé : ${profileError}`); setSubmitting(false); return; }
    const post: Record<string, unknown> = { user_id: user.id, type, content: content.trim() || (type === "musique" && musicEmbed ? musicEmbed.title : ""), url: trimmedUrl || null, category };
    let { error: insertError } = await supabase.from("posts").insert(type === "musique" ? { ...post, metadata: musicEmbed } : post);
    if (insertError && type === "musique" && /metadata/i.test(insertError.message)) {
      ({ error: insertError } = await supabase.from("posts").insert(post));
    }
    if (insertError) { setError(`La publication a échoué : ${insertError.message}`); setSubmitting(false); return; }
    onCreated();
  };

  const field: CSSProperties = { background: t.ground, border: `1px solid ${t.line}`, borderRadius: 8, color: t.text, outline: "none", width: "100%", fontFamily: UI };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }} onClick={onClose}>
      <form onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit} className="w-full" style={{ maxWidth: 500, background: t.surface, borderRadius: 14, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center justify-between">
          <h2 style={{ fontSize: 18, fontWeight: 800, color: t.text, fontFamily: DISPLAY }}>Nouveau post</h2>
          <button type="button" onClick={onClose} style={{ fontSize: 18, color: t.muted, background: "none", border: "none", cursor: "pointer" }}>&times;</button>
        </div>

        <div className="mt-4 flex" style={{ gap: 6 }}>
          {postTypes.map((item) => (
            <button key={item.value} type="button" onClick={() => setType(item.value)}
              style={{ fontSize: 12, padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontFamily: UI, border: "none", ...(type === item.value ? { background: t.primary, color: t.onPrimary } : { background: t.ground, color: t.muted }) }}>
              {item.label}
            </button>
          ))}
        </div>

        {type === "article" && (
          <>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="URL de l'article" className="mt-3 block" style={{ ...field, padding: "10px 14px", fontSize: 13 }} />
            {ogPreview?.title && (
              <div className="mt-2 flex items-center gap-3" style={{ background: t.ground, borderRadius: 8, padding: 10 }}>
                {ogPreview.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ogPreview.image} alt="" style={{ width: 60, height: 44, borderRadius: 4, objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{ogPreview.title}</p>
                  <p className="truncate" style={{ fontSize: 10, color: t.muted }}>{ogPreview.domain}</p>
                </div>
              </div>
            )}
          </>
        )}

        {type === "musique" && (
          <div className="mt-3">
            <input type="url" value={url} onChange={(e) => { setUrl(e.target.value); if (e.target.value.trim() !== lookedUp) { setMusicEmbed(null); setMusicError(false); } }}
              onBlur={(e) => lookUpMusic(e.currentTarget.value)} placeholder="Lien Spotify, Apple Music, Deezer, YouTube..." className="block" style={{ ...field, padding: "10px 14px", fontSize: 13 }} />
            {musicLoading && <p className="mt-2" style={{ fontSize: 11, color: t.muted }}>Recherche&hellip;</p>}
            {musicEmbed && !musicLoading && (
              <div className="mt-2">
                <p className="mb-1.5" style={{ fontSize: 11, color: "#16A34A" }}>&check; Trouv&eacute;</p>
                <SharedMusicCard embed={musicEmbed} href={url.trim()} />
              </div>
            )}
            {musicError && !musicLoading && <p className="mt-2" style={{ fontSize: 11, color: "#DC2626" }}>Lien non reconnu</p>}
          </div>
        )}

        <textarea value={content} onChange={(e) => setContent(e.target.value)} placeholder={type === "reflexion" ? "Ta réflexion..." : "Un commentaire..."} rows={3} className="mt-3 block resize-none" style={{ ...field, padding: "12px 14px", fontSize: 14, lineHeight: 1.5, fontFamily: type === "reflexion" ? READING : UI }} />

        <div className="mt-3 flex flex-wrap" style={{ gap: 5 }}>
          {categoryList.map((cat) => (
            <button key={cat} type="button" onClick={() => setCategory(category === cat ? null : cat)}
              style={{ fontSize: 11, padding: "3px 10px", borderRadius: 4, cursor: "pointer", fontFamily: UI, border: `1px solid ${t.line}`, ...(category === cat ? { background: t.primary, color: t.onPrimary, borderColor: t.primary } : { background: "transparent", color: t.muted }) }}>
              {cat}
            </button>
          ))}
        </div>

        {error && <p className="mt-3" style={{ fontSize: 12, color: "#B4302F" }}>{error}</p>}

        <div className="mt-4 flex justify-end">
          <button type="submit" disabled={(type === "musique" ? !musicEmbed : !content.trim()) || submitting}
            style={{ background: t.primary, color: t.onPrimary, fontSize: 13, fontWeight: 500, fontFamily: UI, padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", opacity: submitting ? 0.6 : 1 }}>
            {submitting ? "Publication…" : "Publier"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────
function FeedSkeleton({ t }: { t: typeof LIGHT }) {
  return (
    <div className="flex flex-col" style={{ gap: 16 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} className="animate-pulse" style={{ background: t.surface, borderRadius: 16, padding: 24, border: `1px solid ${t.line}` }}>
          <div className="flex items-center" style={{ gap: 10, marginBottom: 14 }}>
            <div style={{ width: 38, height: 38, background: t.ground, borderRadius: "50%" }} />
            <div>
              <div style={{ width: 100, height: 14, background: t.ground, borderRadius: 4 }} />
              <div className="mt-1" style={{ width: 140, height: 10, background: t.ground, borderRadius: 4 }} />
            </div>
          </div>
          <div style={{ width: "80%", height: 16, background: t.ground, borderRadius: 4 }} />
          <div className="mt-2" style={{ width: "50%", height: 14, background: t.ground, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  );
}

// ── Follow suggestion sidebar ────────────────────────────────────────────
function SuggestionsPanel({ t, userId }: { t: typeof LIGHT; userId: string | undefined }) {
  const [suggestions, setSuggestions] = useState<PublicProfile[]>([]);
  const [followedSet, setFollowedSet] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getSuggested(userId, 5).then((results) => { if (!cancelled) setSuggestions(results); });
    return () => { cancelled = true; };
  }, [userId]);

  const handleFollow = async (targetId: string) => {
    if (!userId) return;
    const ok = await followUser(userId, targetId);
    if (ok) setFollowedSet((prev) => new Set(prev).add(targetId));
  };

  if (suggestions.length === 0) return null;

  return (
    <div style={{ background: t.surface, borderRadius: 16, padding: 20, border: `1px solid ${t.line}` }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: DISPLAY, marginBottom: 14 }}>
        Personnes &agrave; suivre
      </h3>
      <div className="flex flex-col" style={{ gap: 12 }}>
        {suggestions.map((s) => {
          const displayName = s.name ?? s.username;
          const tone = avatarTones[(s.id.charCodeAt(0) + (s.id.charCodeAt(1) || 0)) % avatarTones.length];
          const followed = followedSet.has(s.id);
          return (
            <div key={s.id} className="flex items-center" style={{ gap: 10 }}>
              <Avatar initials={getInitials(s.name, s.username)} size={32} {...tone} />
              <div className="min-w-0 flex-1">
                <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: t.text, fontFamily: UI }}>{displayName}</p>
                <p className="truncate" style={{ fontSize: 11, color: t.muted, fontFamily: UI }}>@{s.username}</p>
              </div>
              {followed ? (
                <span style={{ fontSize: 11, color: t.muted, fontFamily: UI }}>Suivi &check;</span>
              ) : (
                <button type="button" onClick={() => handleFollow(s.id)}
                  style={{ fontSize: 11, color: t.primary, background: "none", border: `1px solid ${t.line}`, borderRadius: 6, padding: "5px 14px", cursor: "pointer", fontFamily: UI }}>
                  Suivre
                </button>
              )}
            </div>
          );
        })}
      </div>
      <Link href="/explore" style={{ display: "block", marginTop: 14, fontSize: 12, color: t.primary, fontFamily: UI, textDecoration: "none" }}>
        Explorer les profils &rarr;
      </Link>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const router = useRouter();
  const { t, dark, toggle } = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [mine, setMine] = useState<Record<string, MyInteractions>>({});
  const [activeTab, setActiveTab] = useState<FeedTab>("tout");

  const css = `
    @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&f[]=cabinet-grotesk@800&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Literata:ital,wght@0,400;1,400&family=JetBrains+Mono:wght@400&display=swap');
    .shelf-scroll { scrollbar-width: none; }
    .shelf-scroll::-webkit-scrollbar { display: none; }
    .feed-tab { transition: all 0.15s ease; }
    .feed-tab:hover { opacity: 1; }
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
        if (res.ok) { loaded = (await res.json()) as Post[]; }
      } catch {}
    }

    if (!loaded) {
      const { data, error } = await supabase
        .from("posts").select(POST_SELECT)
        .not("content", "ilike", "%Morceau actuel%")
        .not("content", "ilike", "%Test du Raccourci%")
        .order("created_at", { ascending: false }).limit(60);
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

  const closeModal = useCallback(() => setModalOpen(false), []);

  // Filtered posts by tab
  const filteredPosts = useMemo(() => {
    if (!posts) return [];
    if (activeTab === "tout") return posts;
    return posts.filter((p) => p.type === activeTab);
  }, [posts, activeTab]);

  if (!session) return <div className="min-h-screen" style={{ background: t.ground }} />;

  const hasPosts = (posts?.length ?? 0) > 0;

  return (
    <SocialContext.Provider value={{ user: session.user, viewerName: profile?.name ?? null, mine }}>
      <div className="min-h-screen" style={{ background: t.ground, color: t.text, fontFamily: UI }}>
        <style>{css}</style>

        {/* Minimal cinematic nav */}
        <header style={{
          position: "fixed", top: 0, left: 0, right: 0, zIndex: 30,
          background: dark ? "rgba(18,26,58,0.85)" : "rgba(236,238,234,0.85)",
          backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        }}>
          <div className="mx-auto flex items-center justify-between" style={{ maxWidth: 1200, padding: "14px 28px" }}>
            <Link href="/dashboard" style={{ fontSize: 20, fontWeight: 800, color: t.text, fontFamily: DISPLAY, textDecoration: "none", letterSpacing: "-0.03em" }}>
              boredboard
            </Link>
            <div className="flex items-center" style={{ gap: 10 }}>
              <button type="button" onClick={() => setModalOpen(true)} style={{
                background: t.primary, color: t.onPrimary,
                fontSize: 13, fontWeight: 600, fontFamily: UI,
                padding: "8px 20px", borderRadius: 8, border: "none", cursor: "pointer",
              }}>
                + Partager
              </button>
              <button type="button" onClick={toggle} style={{
                fontSize: 12, fontWeight: 500, fontFamily: UI,
                padding: "8px 16px", borderRadius: 20,
                border: `1px solid ${t.line}`, background: "transparent", color: t.muted, cursor: "pointer",
              }}>
                {dark ? "Mode jour" : "Mode nuit"}
              </button>
              <Link href="/profile" className="flex shrink-0 items-center justify-center" style={{
                width: 34, height: 34, borderRadius: "50%",
                background: t.primary, color: t.onPrimary,
                fontSize: 12, fontWeight: 500, textDecoration: "none", fontFamily: UI,
              }}>
                {getInitials(profile?.name ?? null, session.user.email)}
              </Link>
            </div>
          </div>
        </header>

        <div style={{ paddingTop: 70 }}>
          {/* Hero — always visible, smaller when there are posts */}
          <div className="mx-auto" style={{ maxWidth: 1200, padding: "0 28px" }}>
            <div style={{ paddingTop: hasPosts ? "4vh" : "8vh", paddingBottom: hasPosts ? 20 : 40 }}>
              <h1 style={{
                fontSize: hasPosts ? "clamp(24px, 3vw, 36px)" : "clamp(36px, 5.5vw, 72px)",
                fontWeight: 400, fontStyle: "italic",
                fontFamily: HERO_SERIF, color: t.text, lineHeight: 1.1, letterSpacing: "-0.02em",
                maxWidth: 900, transition: "font-size 0.3s ease",
              }}>
                {hasPosts ? "Les étagères autour de toi" : "Regarde ce que lisent et écoutent les gens curieux autour de toi."}
              </h1>

              {!hasPosts && (
                <>
                  <p style={{
                    marginTop: 24, fontSize: "clamp(15px, 1.4vw, 18px)", color: t.muted,
                    fontFamily: UI, lineHeight: 1.65, maxWidth: 600,
                  }}>
                    Partage un morceau depuis Apple Music ou Spotify, un article, le livre que tu as sur ta table de nuit. Tes amis voient ton &eacute;tag&egrave;re, tu vois la leur.
                  </p>
                  <div className="flex flex-wrap" style={{ gap: 12, marginTop: 32 }}>
                    <button type="button" onClick={() => setModalOpen(true)} style={{
                      background: dark ? "#E6E8E3" : t.primary, color: dark ? "#121A3A" : t.onPrimary,
                      fontSize: 15, fontWeight: 600, fontFamily: UI, padding: "14px 32px", borderRadius: 10, border: "none", cursor: "pointer",
                    }}>
                      Cr&eacute;er mon &eacute;tag&egrave;re
                    </button>
                    <Link href="/explore" style={{
                      fontSize: 15, fontWeight: 500, fontFamily: UI, color: t.text, textDecoration: "none",
                      padding: "14px 32px", borderRadius: 10, border: `1px solid ${t.line}`, display: "inline-flex", alignItems: "center",
                    }}>
                      Voir une &eacute;tag&egrave;re d&apos;exemple
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Tab bar */}
          {hasPosts && (
            <div style={{ borderBottom: `1px solid ${t.line}`, marginBottom: 28 }}>
              <div className="mx-auto shelf-scroll flex overflow-x-auto" style={{ maxWidth: 1200, padding: "0 28px", gap: 4 }}>
                {TABS.map((tab) => {
                  const active = activeTab === tab.value;
                  const count = tab.value === "tout" ? posts?.length ?? 0 : posts?.filter((p) => p.type === tab.value).length ?? 0;
                  return (
                    <button
                      key={tab.value}
                      type="button"
                      onClick={() => setActiveTab(tab.value)}
                      className="feed-tab"
                      style={{
                        fontSize: 13, fontWeight: active ? 600 : 400, fontFamily: UI,
                        padding: "12px 18px", cursor: "pointer",
                        background: "transparent", border: "none",
                        color: active ? t.text : t.muted,
                        borderBottom: active ? `2px solid ${t.primary}` : "2px solid transparent",
                        opacity: active ? 1 : 0.7,
                        whiteSpace: "nowrap",
                      }}
                    >
                      {tab.icon} {tab.label} <span style={{ fontSize: 11, opacity: 0.6 }}>({count})</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main content area */}
          <div className="mx-auto" style={{ maxWidth: 1200, padding: "0 28px 96px" }}>
            {feedError ? (
              <div className="text-center" style={{ padding: "60px 20px" }}>
                <p style={{ fontSize: 15, fontWeight: 500, color: t.text, fontFamily: UI }}>Impossible de charger le feed</p>
                <p className="mt-2" style={{ fontSize: 12, color: "#B4302F", fontFamily: UI }}>{feedError}</p>
                <button type="button" onClick={loadPosts} className="mt-4" style={{ fontSize: 12, padding: "8px 20px", borderRadius: 6, border: `1px solid ${t.line}`, color: t.muted, background: "none", cursor: "pointer", fontFamily: UI }}>
                  R&eacute;essayer
                </button>
              </div>
            ) : posts === null ? (
              <FeedSkeleton t={t} />
            ) : hasPosts ? (
              <div className="grid gap-8" style={{ gridTemplateColumns: "1fr", maxWidth: 680 }}>
                {/* Social feed */}
                <div className="flex flex-col" style={{ gap: 16 }}>
                  {filteredPosts.map((post) => (
                    <FeedPost key={post.id} post={post} t={t} />
                  ))}
                  {filteredPosts.length === 0 && (
                    <div className="text-center" style={{ padding: "48px 20px" }}>
                      <p style={{ fontSize: 40, marginBottom: 12 }}>{TABS.find((tab) => tab.value === activeTab)?.icon}</p>
                      <p style={{ fontSize: 15, color: t.muted, fontFamily: UI }}>
                        Aucun contenu dans cette cat&eacute;gorie pour le moment.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* Empty state placeholder */
              <div style={{ opacity: 0.4 }}>
                <div className="shelf-scroll flex overflow-x-auto" style={{ gap: 16, paddingBottom: 24 }}>
                  {[
                    { w: 170, h: 170, r: 10 }, { w: 130, h: 190, r: 6 }, { w: 170, h: 170, r: 10 },
                    { w: 130, h: 190, r: 6 }, { w: 170, h: 170, r: 10 }, { w: 220, h: 170, r: 10 },
                    { w: 130, h: 190, r: 6 }, { w: 170, h: 170, r: 10 },
                  ].map((s, i) => (
                    <div key={i} style={{ width: s.w, height: s.h, borderRadius: s.r, background: t.surface, flexShrink: 0 }} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile FAB */}
        <button type="button" onClick={() => setModalOpen(true)} aria-label="Nouveau post"
          className="fixed bottom-6 right-6 z-20 flex items-center justify-center md:hidden"
          style={{
            background: dark ? "#E6E8E3" : t.primary, color: dark ? "#121A3A" : t.onPrimary,
            width: 56, height: 56, borderRadius: "50%", fontSize: 26, border: "none", cursor: "pointer",
            boxShadow: "0 4px 24px rgba(0,0,0,0.3)",
          }}>
          +
        </button>

        {modalOpen && <NewPostModal user={session.user} onClose={closeModal} onCreated={() => { setModalOpen(false); loadPosts(); }} t={t} />}
      </div>
    </SocialContext.Provider>
  );
}

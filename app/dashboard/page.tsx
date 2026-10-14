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
import { SocialContext, socialCss, type MyInteractions } from "@/components/dashboard/SocialActions";
import { fetchEmbed, parseEmbed, type MusicEmbed } from "@/lib/music";
import { ensureProfile } from "@/lib/profile";
import { claimReferral } from "@/lib/referral";
import { avatarTones } from "@/lib/sample-data";
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

/** Dark by default, toggle persisted in localStorage */
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

const postTypes: { value: PostType; label: string }[] = [
  { value: "musique", label: "Musique" },
  { value: "article", label: "Article" },
  { value: "livre", label: "Livre" },
  { value: "reflexion", label: "Réflexion" },
];

const categoryList = ["Géopolitique", "Histoire", "Science", "Art", "Musique", "Littérature", "Tech"];

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

// ── Group posts into shelves by user ──────────────────────────────────────
type ShelfGroup = {
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  posts: Post[];
  isListening: boolean;
};

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
        avatarUrl: post.profiles?.avatar_url ?? null,
        posts: [post],
        isListening: false,
      });
    }
  }
  for (const shelf of map.values()) {
    const recentMusic = shelf.posts.find(
      (p) => p.type === "musique" && Date.now() - new Date(p.created_at).getTime() < 2 * 60 * 60 * 1000
    );
    if (recentMusic) shelf.isListening = true;
  }
  return [...map.values()];
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

// ── Shelf item components — BIGGER for cinematic look ────────────────────

function MusicShelfItem({ post, t }: { post: Post; t: typeof LIGHT }) {
  const track = parseShortcutTrack(post.metadata);
  const embed = post.type === "musique" ? parseEmbed(post.metadata) : null;
  const artwork = track?.artwork ?? embed?.thumbnail ?? null;
  const title = track?.title ?? embed?.title ?? post.content;
  const artist = track?.artist ?? embed?.artist ?? null;
  const url = track?.trackUrl ?? post.url;
  const [imgFailed, setImgFailed] = useState(false);

  const cover = (
    <div className="shelf-item group" style={{ width: 170, flexShrink: 0 }}>
      <div className="relative overflow-hidden" style={{ width: 170, height: 170, borderRadius: 10, background: t.surface }}>
        {artwork && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artwork} alt={title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgFailed(true)} />
        ) : (
          <div className="flex h-full items-center justify-center" style={{ fontSize: 40, color: t.ink(0.12) }}>&#9835;</div>
        )}
      </div>
      <p className="mt-2 truncate" style={{ fontSize: 13, fontWeight: 500, color: t.text, fontFamily: UI }}>{title}</p>
      {artist && <p className="truncate" style={{ fontSize: 11, color: t.muted, fontFamily: UI }}>{artist}</p>}
    </div>
  );

  return url ? (
    <a href={url} target="_blank" rel="noopener noreferrer" className="block" style={{ color: "inherit", textDecoration: "none" }}>{cover}</a>
  ) : cover;
}

function BookShelfItem({ post, t }: { post: Post; t: typeof LIGHT }) {
  const link = safeUrl(post.url);
  const [imgFailed, setImgFailed] = useState(false);
  const meta = post.metadata as Record<string, unknown> | undefined;
  const coverImg = httpsOrNull(meta?.cover_url) ?? httpsOrNull(meta?.image);
  const parts = post.content.split(" — ");
  const bookTitle = parts[0]?.slice(0, 50) ?? post.content.slice(0, 50);
  const author = parts[1] ?? null;

  const content = (
    <div className="shelf-item" style={{ width: 130, flexShrink: 0 }}>
      <div className="relative overflow-hidden" style={{ width: 130, height: 190, borderRadius: 6, background: t.surface }}>
        {coverImg && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={coverImg} alt={bookTitle} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} onError={() => setImgFailed(true)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center p-3 text-center" style={{ background: t.surface }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: t.text, fontFamily: UI, lineHeight: 1.3 }}>{bookTitle}</span>
          </div>
        )}
      </div>
      <p className="mt-2 truncate" style={{ fontSize: 12, fontWeight: 500, color: t.text, fontFamily: UI }}>{bookTitle}</p>
      {author && <p className="truncate" style={{ fontSize: 11, color: t.muted, fontFamily: UI }}>{author}</p>}
    </div>
  );

  return link ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className="block" style={{ color: "inherit", textDecoration: "none" }}>{content}</a>
  ) : content;
}

function ArticleShelfItem({ post, t }: { post: Post; t: typeof LIGHT }) {
  const link = safeUrl(post.url);
  const og = useOgPreview(post.url);
  const ogImage = og?.image ?? null;
  const siteName = og?.siteName ?? og?.domain ?? null;
  const ogTitle = og?.title ?? null;
  const displayTitle = ogTitle ?? post.content.slice(0, 90);
  const [imgFailed, setImgFailed] = useState(false);

  const card = (
    <div className="shelf-item" style={{ width: 220, flexShrink: 0 }}>
      <div className="flex flex-col overflow-hidden" style={{ width: 220, height: 170, borderRadius: 10, background: t.surface, border: `1px solid ${t.line}` }}>
        {ogImage && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={ogImage} alt="" loading="lazy" style={{ width: "100%", height: 90, objectFit: "cover", display: "block" }} onError={() => setImgFailed(true)} />
        ) : null}
        <div style={{ padding: "12px 16px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            {siteName && (
              <p style={{ fontSize: 10, color: t.muted, fontFamily: MONO, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{siteName}</p>
            )}
            <p style={{ fontSize: 13, fontWeight: 600, color: t.text, fontFamily: UI, lineHeight: 1.35, display: "-webkit-box", WebkitLineClamp: ogImage ? 2 : 4, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>{displayTitle}</p>
          </div>
          {post.category && <p style={{ fontSize: 10, color: t.muted, fontFamily: UI }}>{post.category}</p>}
        </div>
      </div>
    </div>
  );

  return link ? (
    <a href={link.href} target="_blank" rel="noopener noreferrer" className="block" style={{ color: "inherit", textDecoration: "none" }}>{card}</a>
  ) : card;
}

function QuoteShelfItem({ post, t }: { post: Post; t: typeof LIGHT }) {
  return (
    <div className="shelf-item" style={{ width: 220, flexShrink: 0 }}>
      <div className="flex items-start" style={{ width: 220, minHeight: 170, borderRadius: 10, background: t.surface, padding: 18, border: `1px solid ${t.line}` }}>
        <p style={{ fontSize: 15, color: t.text, fontFamily: READING, fontWeight: 400, lineHeight: 1.55, fontStyle: "italic", display: "-webkit-box", WebkitLineClamp: 6, WebkitBoxOrient: "vertical" as const, overflow: "hidden" }}>
          &laquo; {post.content.slice(0, 200)} &raquo;
        </p>
      </div>
      {post.category && <p className="mt-1.5" style={{ fontSize: 10, color: t.muted, fontFamily: UI }}>{post.category}</p>}
    </div>
  );
}

// ── Shelf row for one person ──────────────────────────────────────────────
function PersonShelf({ shelf, t }: { shelf: ShelfGroup; t: typeof LIGHT }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const count = shelf.posts.length;
  const subtitle = shelf.isListening
    ? "écoute en ce moment"
    : `${count} ${count > 1 ? "partages" : "partage"} récent${count > 1 ? "s" : ""}`;
  const tone = avatarTones[(shelf.userId.charCodeAt(0) + shelf.userId.charCodeAt(1)) % avatarTones.length];

  return (
    <section style={{ marginBottom: 48 }}>
      <div className="flex items-center justify-between" style={{ marginBottom: 16, paddingBottom: 10, borderBottom: `1px solid ${t.line}` }}>
        <Link href={`/profile?id=${shelf.userId}`} className="flex items-center" style={{ gap: 12, textDecoration: "none" }}>
          <Avatar initials={getInitials(shelf.name, shelf.username)} size={36} {...tone} />
          <div>
            <h2 style={{ fontSize: 20, fontWeight: 800, color: t.text, fontFamily: DISPLAY, letterSpacing: "-0.02em", lineHeight: 1 }}>
              {shelf.name.split(" ")[0]}
            </h2>
            <span style={{ fontSize: 12, color: t.muted, fontFamily: UI }}>
              {subtitle}
              {shelf.isListening && <span style={{ marginLeft: 6, color: "#16A34A" }}>&#9679;</span>}
            </span>
          </div>
        </Link>
        <Link href={`/profile?id=${shelf.userId}`} style={{ fontSize: 12, color: t.primary, fontFamily: UI, textDecoration: "none" }}>
          Voir l&apos;étagère &rarr;
        </Link>
      </div>
      <div ref={scrollRef} className="shelf-scroll flex overflow-x-auto" style={{ gap: 16, paddingBottom: 4 }}>
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
                <p className="mb-1.5" style={{ fontSize: 11, color: "#16A34A" }}>&check; Trouvé</p>
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

// ── Loading skeleton ──────────────────────────────────────────────────────
function ShelfSkeleton({ t }: { t: typeof LIGHT }) {
  return (
    <div className="animate-pulse" style={{ marginBottom: 48 }}>
      <div className="flex items-center" style={{ gap: 12, marginBottom: 16 }}>
        <div style={{ width: 36, height: 36, background: t.surface, borderRadius: "50%" }} />
        <div>
          <div style={{ width: 100, height: 16, background: t.surface, borderRadius: 4 }} />
          <div className="mt-1" style={{ width: 140, height: 12, background: t.surface, borderRadius: 4 }} />
        </div>
      </div>
      <div className="flex" style={{ gap: 16 }}>
        {[0, 1, 2, 3, 4, 5].map((j) => (
          <div key={j} style={{ width: 170, height: 170, background: t.surface, borderRadius: 10, flexShrink: 0 }} />
        ))}
      </div>
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

  const css = `
    @import url('https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&f[]=cabinet-grotesk@800&display=swap');
    @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Literata:ital,wght@0,400;1,400&family=JetBrains+Mono:wght@400&display=swap');
    .shelf-scroll { scrollbar-width: none; }
    .shelf-scroll::-webkit-scrollbar { display: none; }
    .shelf-item { transition: transform 0.18s ease; }
    .shelf-item:hover { transform: translateY(-4px); }
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
      } catch { /* network error - fall back */ }
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

  const closeModal = useCallback(() => setModalOpen(false), []);
  const shelves = useMemo(() => posts ? groupIntoShelves(posts) : [], [posts]);

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
          <div className="mx-auto flex items-center justify-between" style={{ maxWidth: 1200, padding: "16px 28px" }}>
            <Link href="/dashboard" style={{ fontSize: 20, fontWeight: 800, color: t.text, fontFamily: DISPLAY, textDecoration: "none", letterSpacing: "-0.03em" }}>
              boredboard
            </Link>
            <div className="flex items-center" style={{ gap: 12 }}>
              <button type="button" onClick={toggle} style={{
                fontSize: 13, fontWeight: 500, fontFamily: UI,
                padding: "8px 18px", borderRadius: 20,
                border: `1px solid ${t.line}`, background: "transparent", color: t.text, cursor: "pointer",
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

        {/* Hero section */}
        {!hasPosts || posts === null ? (
          <div style={{ paddingTop: 80 }}>
            <main className="mx-auto" style={{ maxWidth: 1200, padding: "0 28px" }}>
              <div style={{ paddingTop: "10vh", paddingBottom: 48 }}>
                <h1 style={{
                  fontSize: "clamp(36px, 5.5vw, 72px)", fontWeight: 400, fontStyle: "italic",
                  fontFamily: HERO_SERIF, color: t.text, lineHeight: 1.1, letterSpacing: "-0.02em", maxWidth: 900,
                }}>
                  Regarde ce que lisent et &eacute;coutent les gens curieux autour de toi.
                </h1>
                <p style={{
                  marginTop: 28, fontSize: "clamp(15px, 1.4vw, 18px)", color: t.muted,
                  fontFamily: UI, lineHeight: 1.65, maxWidth: 600,
                }}>
                  Partage un morceau depuis Apple Music ou Spotify, un article, le livre que tu as sur ta table de nuit. Tes amis voient ton &eacute;tag&egrave;re, tu vois la leur.
                </p>
                <div className="flex flex-wrap" style={{ gap: 12, marginTop: 36 }}>
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
              </div>

              {posts === null ? (
                <div style={{ paddingTop: 20 }}><ShelfSkeleton t={t} /></div>
              ) : (
                <div style={{ paddingTop: 20, opacity: 0.5 }}>
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
            </main>
          </div>
        ) : (
          /* Feed: full-width shelves */
          <main className="mx-auto" style={{ maxWidth: 1200, padding: "100px 28px 96px" }}>
            {feedError ? (
              <div className="text-center" style={{ padding: "60px 20px" }}>
                <p style={{ fontSize: 15, fontWeight: 500, color: t.text, fontFamily: UI }}>Impossible de charger le feed</p>
                <p className="mt-2" style={{ fontSize: 12, color: "#B4302F", fontFamily: UI }}>{feedError}</p>
                <button type="button" onClick={loadPosts} className="mt-4" style={{ fontSize: 12, padding: "8px 20px", borderRadius: 6, border: `1px solid ${t.line}`, color: t.muted, background: "none", cursor: "pointer", fontFamily: UI }}>
                  R&eacute;essayer
                </button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: 48 }}>
                  <h1 style={{
                    fontSize: "clamp(28px, 4vw, 48px)", fontWeight: 400, fontStyle: "italic",
                    fontFamily: HERO_SERIF, color: t.text, lineHeight: 1.15, letterSpacing: "-0.02em",
                  }}>
                    Les &eacute;tag&egrave;res autour de toi
                  </h1>
                </div>
                {shelves.map((shelf) => (
                  <PersonShelf key={shelf.userId} shelf={shelf} t={t} />
                ))}
              </div>
            )}
          </main>
        )}

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

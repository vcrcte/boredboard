"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
import Navbar, { getInitials } from "@/components/Navbar";
import SharedMusicCard from "@/components/MusicCard";
import NewsCard, { NewsError, NewsSkeleton } from "@/components/NewsCard";
import Customizer from "@/components/dashboard/Customizer";
import Actions, { SocialContext, socialCss, type MyInteractions } from "@/components/dashboard/SocialActions";
import {
  DiscussionsCard,
  MarketsFlashCard,
  NowListeningCard,
  ReadingNowCard,
  socialCardsCss,
} from "@/components/dashboard/SocialCards";
import { fetchEmbed, parseEmbed, type MusicEmbed } from "@/lib/music";
import { useNews } from "@/lib/news";
import {
  DEFAULT_PREFERENCES,
  readLocalPreferences,
  readRemotePreferences,
  savePreferences,
  themesQuery,
  type ModuleId,
  type Preferences,
} from "@/lib/preferences";
import { ensureProfile } from "@/lib/profile";
import { avatarTones } from "@/lib/sample-data";
import { getUserSubscriptions, NEWSLETTER_SOURCES } from "@/lib/newsletter";
import { getUserPodcastSubscriptions } from "@/lib/podcasts";
import { getFollowing, type PublicProfile } from "@/lib/social";
import { supabase } from "@/lib/supabase";

// ── Theme tokens (light/dark) ─────────────────────────────────────────────
const LIGHT = {
  cream: "#F7F4EE", surface: "#F0EBE1", white: "#FFFFFF",
  text: "#1C1A15", indigo: "#2A3560",
  ink: (a: number) => `rgba(28,26,21,${a})`,
  black: (a: number) => `rgba(0,0,0,${a})`,
  warmShadow: "0 2px 12px rgba(28,26,21,0.06), 0 0 0 1px rgba(0,0,0,0.04)",
  hoverShadow: "0 4px 20px rgba(28,26,21,0.1), 0 0 0 1px rgba(0,0,0,0.06)",
};

const DARK = {
  cream: "#1A1A2E", surface: "#16213E", white: "#1E1E30",
  text: "#E8E6E1", indigo: "#7B8CDE",
  ink: (a: number) => `rgba(232,230,225,${a})`,
  black: (a: number) => `rgba(255,255,255,${a})`,
  warmShadow: "0 2px 12px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.06)",
  hoverShadow: "0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.08)",
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

const ACCENT_GRADIENT = "linear-gradient(135deg, #2A3560, #534AB7)";

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

type NewsletterArticle = {
  title: string;
  description: string;
  url: string;
  source_id: string;
  source_name: string;
  source_icon: string;
  source_color: string;
  theme: string;
  published_at: string;
};

type OgData = { title: string | null; description: string | null; image: string | null; domain: string | null; siteName: string | null };

const NEWS_IN_FEED = 3;
const POST_SELECT = "*, profiles (id, name, username, avatar_url)";

const filters = ["Tout", "Actualités", "Musique", "Livres", "Podcasts", "Découvertes", "Philo", "Science", "Art"];

const postTypes: { value: PostType; label: string; verb: string; filter: string }[] = [
  { value: "article", label: "Article", verb: "partage un article", filter: "Actualités" },
  { value: "reflexion", label: "Réflexion", verb: "partage une réflexion", filter: "Découvertes" },
  { value: "livre", label: "Livre", verb: "lit", filter: "Livres" },
  { value: "musique", label: "Musique", verb: "partage une musique", filter: "Musique" },
];

const tones = {
  green: { background: "rgba(29,158,117,0.1)", color: "#0F6E56" },
  violet: { background: "rgba(131,77,255,0.08)", color: "#6B3FD4" },
  indigo: { background: "rgba(83,74,183,0.08)", color: "#534AB7" },
  olive: { background: "rgba(59,109,17,0.08)", color: "#3B6D11" },
  rose: { background: "rgba(153,53,86,0.08)", color: "#993556" },
  gold: { background: "rgba(196,169,74,0.12)", color: "#8B6914" },
};

const categories: { label: string; tone: keyof typeof tones; filter?: string }[] = [
  { label: "Géopolitique", tone: "green" },
  { label: "Histoire", tone: "gold" },
  { label: "Philosophie", tone: "indigo", filter: "Philo" },
  { label: "Science", tone: "green", filter: "Science" },
  { label: "Art", tone: "rose", filter: "Art" },
  { label: "Musique", tone: "violet" },
  { label: "Littérature", tone: "olive" },
  { label: "Tech", tone: "indigo" },
];

const navItems: { icon: string; label: string; filter?: string; href?: string }[] = [
  { icon: "\u{1F3E0}", label: "Mon espace", filter: "Tout" },
  { icon: "\u{1F9ED}", label: "Explorer", href: "/explore" },
  { icon: "\u{1F3B5}", label: "Musique", filter: "Musique" },
  { icon: "\u{1F4D6}", label: "Livres", href: "/livres" },
  { icon: "✉️", label: "Newsletter", href: "/newsletter" },
];

const spaces: { icon: string; title: string; detail: string; filter?: string; href?: string }[] = [
  { icon: "\u{1F3B5}", title: "Musique", detail: "4 titres", filter: "Musique" },
  { icon: "\u{1F4D6}", title: "Livres", detail: "en cours", href: "/livres" },
  { icon: "\u{1F399}", title: "Podcasts", detail: "favoris", href: "/podcasts" },
];

function timeAgo(date: string) {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return "à l’instant";
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

function postTags(post: Post) {
  const tags = [postTypes.find((t) => t.value === post.type)?.filter];
  tags.push(categories.find((c) => c.label === post.category)?.filter);
  return tags.filter((t): t is string => Boolean(t));
}

// ── Scroll fade-in animation hook ─────────────────────────────────────────
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.style.opacity = "1";
          el.style.transform = "translateY(0)";
          obs.unobserve(el);
        }
      },
      { threshold: 0.1 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function FadeIn({ children, className = "" }: { children: ReactNode; className?: string }) {
  const ref = useFadeIn();
  return (
    <div
      ref={ref}
      className={className}
      style={{ opacity: 0, transform: "translateY(16px)", transition: "opacity 0.5s ease-out, transform 0.5s ease-out" }}
    >
      {children}
    </div>
  );
}

// ── OG Preview hook ───────────────────────────────────────────────────────
function useOgPreview(url: string | null) {
  const [og, setOg] = useState<OgData | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(`/api/og?url=${encodeURIComponent(url)}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => { if (!cancelled && data) setOg(data); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url]);
  return og;
}

// ── Components ────────────────────────────────────────────────────────────
function Avatar({ initials, size, background, color }: { initials: string; size: number; background: string; color: string }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, background, color, borderRadius: "50%", fontSize: Math.max(9, size * 0.36), fontWeight: 500 }}
    >
      {initials}
    </span>
  );
}

function Pill({ tone, children }: { tone: keyof typeof tones; children: ReactNode }) {
  return (
    <span className="shrink-0" style={{ ...tones[tone], fontSize: 10, borderRadius: 10, padding: "2px 8px" }}>
      {children}
    </span>
  );
}

function SectionLabel({ children, t }: { children: ReactNode; t: typeof LIGHT }) {
  return (
    <h2 className="mb-3" style={{ fontSize: 9, color: t.ink(0.35), letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 400 }}>
      {children}
    </h2>
  );
}

function Divider({ t }: { t: typeof LIGHT }) {
  return <div className="my-4" style={{ height: 1, background: t.black(0.06) }} />;
}

function CardHeader({ avatar, name, verb, pill, time, t }: {
  avatar: ReactNode; name: string; verb: string; pill?: ReactNode; time?: string; t: typeof LIGHT;
}) {
  return (
    <div className="flex items-center gap-3">
      {avatar}
      <div className="min-w-0 flex-1">
        <p className="truncate" style={{ fontSize: 13 }}>
          <span style={{ fontWeight: 600, color: t.text }}>{name}</span>{" "}
          <span style={{ color: t.ink(0.5) }}>{verb}</span>
        </p>
        <div className="mt-0.5 flex items-center gap-2">
          {pill}
          {time && <span style={{ fontSize: 11, color: t.ink(0.35) }}>{time}</span>}
        </div>
      </div>
    </div>
  );
}

// ── OG Link Preview Card ──────────────────────────────────────────────────
function OgPreviewCard({ url, t }: { url: string; t: typeof LIGHT }) {
  const og = useOgPreview(url);
  if (!og || (!og.title && !og.description && !og.image)) {
    // Fallback to simple link
    const link = safeUrl(url);
    if (!link) return null;
    return (
      <a href={link.href} target="_blank" rel="noopener noreferrer"
        className="mt-3 flex items-center truncate hover:underline"
        style={{ background: t.cream, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: t.indigo, gap: 6 }}>
        <span aria-hidden>↗</span>
        <span className="truncate">{link.hostname.replace(/^www\./, "")}{link.pathname !== "/" && link.pathname}</span>
      </a>
    );
  }

  return (
    <a href={url} target="_blank" rel="noopener noreferrer"
      className="mt-3 block overflow-hidden hover:opacity-90 transition-opacity"
      style={{ borderRadius: 12, border: `1px solid ${t.black(0.08)}`, textDecoration: "none" }}>
      {og.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={og.image}
          alt=""
          loading="lazy"
          style={{ width: "100%", height: 180, objectFit: "cover", display: "block" }}
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div style={{ padding: "10px 14px", background: t.cream }}>
        <p className="truncate" style={{ fontSize: 11, color: t.ink(0.4), textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {og.siteName ?? og.domain ?? ""}
        </p>
        {og.title && (
          <p className="mt-0.5 line-clamp-2" style={{ fontSize: 13, fontWeight: 600, color: t.text, lineHeight: 1.4 }}>
            {og.title}
          </p>
        )}
        {og.description && (
          <p className="mt-0.5 line-clamp-2" style={{ fontSize: 11, color: t.ink(0.5), lineHeight: 1.4 }}>
            {og.description}
          </p>
        )}
      </div>
    </a>
  );
}

// ── Mini Spotify/Deezer embed player ──────────────────────────────────────
function MiniPlayer({ url }: { url: string }) {
  // Spotify
  const spotifyMatch = /open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/.exec(url);
  if (spotifyMatch) {
    const [, type, id] = spotifyMatch;
    return (
      <div className="mt-3" style={{ borderRadius: 12, overflow: "hidden" }}>
        <iframe
          src={`https://open.spotify.com/embed/${type}/${id}?utm_source=generator&theme=0`}
          width="100%"
          height={type === "track" ? 80 : 152}
          allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
          loading="lazy"
          style={{ border: "none", borderRadius: 12 }}
          title="Spotify player"
        />
      </div>
    );
  }

  // Deezer
  const deezerMatch = /deezer\.com\/(track|album|playlist)\/(\d+)/.exec(url);
  if (deezerMatch) {
    const [, type, id] = deezerMatch;
    return (
      <div className="mt-3" style={{ borderRadius: 12, overflow: "hidden" }}>
        <iframe
          src={`https://widget.deezer.com/widget/dark/${type}/${id}`}
          width="100%"
          height={type === "track" ? 80 : 152}
          allow="encrypted-media; clipboard-write"
          loading="lazy"
          style={{ border: "none", borderRadius: 12 }}
          title="Deezer player"
        />
      </div>
    );
  }

  return null;
}

// ── Stories bar ────────────────────────────────────────────────────────────
function StoriesBar({ following, posts, t }: { following: PublicProfile[]; posts: Post[] | null; t: typeof LIGHT }) {
  const recentPosters = new Set(
    (posts ?? [])
      .filter((p) => Date.now() - new Date(p.created_at).getTime() < 48 * 60 * 60 * 1000)
      .map((p) => p.user_id),
  );
  const activeUsers = following.filter((u) => recentPosters.has(u.id));
  const inactiveUsers = following.filter((u) => !recentPosters.has(u.id)).slice(0, 4);
  const allUsers = [...activeUsers, ...inactiveUsers].slice(0, 12);

  if (allUsers.length === 0) return null;

  return (
    <div className="db-noscrollbar flex overflow-x-auto" style={{ gap: 14, paddingBottom: 4 }}>
      {allUsers.map((user) => {
        const tone = avatarTones[(user.id.charCodeAt(0) + user.id.charCodeAt(1)) % avatarTones.length];
        const isActive = recentPosters.has(user.id);
        return (
          <Link key={user.id} href={`/profile?id=${user.id}`} className="flex shrink-0 flex-col items-center" style={{ gap: 4, width: 68 }}>
            <span
              className={isActive ? "db-story-ring" : ""}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 58, height: 58, borderRadius: "50%", padding: 3, background: isActive ? undefined : t.black(0.08) }}
            >
              <Avatar initials={getInitials(user.name, user.username)} size={52} {...tone} />
            </span>
            <span className="w-full truncate text-center" style={{ fontSize: 10, color: isActive ? t.text : t.ink(0.45), fontWeight: isActive ? 500 : 400 }}>
              {user.name?.split(" ")[0] ?? user.username}
            </span>
          </Link>
        );
      })}
    </div>
  );
}

// ── Compose prompt ────────────────────────────────────────────────────────
function ComposePrompt({ initials, displayName, onOpen, t }: { initials: string; displayName: string; onOpen: () => void; t: typeof LIGHT }) {
  const card: CSSProperties = { background: t.white, boxShadow: t.warmShadow, borderRadius: 16, padding: 14, border: "none", cursor: "pointer" };
  return (
    <div className="db-compose" style={card} onClick={onOpen}>
      <div className="flex items-center gap-3">
        <Avatar initials={initials} size={42} background={t.indigo} color={t.cream} />
        <div className="flex-1" style={{ background: t.cream, borderRadius: 24, padding: "12px 18px", fontSize: 13, color: t.ink(0.35) }}>
          Qu&apos;est-ce que tu partages, {displayName.split(" ")[0]} ?
        </div>
      </div>
      <div className="mt-3 flex items-center justify-around" style={{ borderTop: `1px solid ${t.black(0.05)}`, paddingTop: 10 }}>
        {[
          { icon: "\u{1F3B5}", label: "Musique", color: "#6B3FD4" },
          { icon: "\u{1F4D6}", label: "Livre", color: "#3B6D11" },
          { icon: "\u{1F4F0}", label: "Article", color: "#2A3560" },
          { icon: "\u{1F4AD}", label: "Réflexion", color: "#993556" },
        ].map((item) => (
          <button key={item.label} type="button" onClick={(e) => { e.stopPropagation(); onOpen(); }}
            className="db-hover flex items-center" style={{ gap: 6, fontSize: 12, color: item.color, padding: "4px 10px", borderRadius: 8, fontWeight: 500 }}>
            <span aria-hidden>{item.icon}</span>{item.label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Dynamic trending topics ───────────────────────────────────────────────
function TrendingTopics({ posts, t }: { posts: Post[] | null; t: typeof LIGHT }) {
  // Compute trending from actual post categories
  const categoryCounts = new Map<string, number>();
  for (const post of posts ?? []) {
    if (post.category) {
      categoryCounts.set(post.category, (categoryCounts.get(post.category) ?? 0) + 1);
    }
    // Also count by type
    const typeLabel = postTypes.find((pt) => pt.value === post.type)?.filter;
    if (typeLabel) {
      categoryCounts.set(typeLabel, (categoryCounts.get(typeLabel) ?? 0) + 1);
    }
  }

  // Fallback static trends if no posts
  const staticTrends = [
    { tag: "#NouvelleVague", posts: 12, category: "Cinéma" },
    { tag: "#PrixGoncourt", posts: 8, category: "Littérature" },
    { tag: "#Impressionnisme", posts: 6, category: "Art" },
    { tag: "#PhiloContemporaine", posts: 5, category: "Philo" },
    { tag: "#JazzManouche", posts: 4, category: "Musique" },
  ];

  const dynamicTrends = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([cat, count]) => ({
      tag: `#${cat.replace(/\s+/g, "")}`,
      posts: count,
      category: cat,
    }));

  const trends = dynamicTrends.length >= 3 ? dynamicTrends : staticTrends;

  return (
    <div className="flex flex-col" style={{ gap: 0 }}>
      {trends.map((trend, i) => (
        <div key={trend.tag} className="db-trending" style={{ padding: "10px 10px", borderRadius: 10, cursor: "pointer" }}>
          <div className="flex items-baseline justify-between">
            <span style={{ fontSize: 12, fontWeight: 600, color: t.text }}>{trend.tag}</span>
            <span style={{ fontSize: 10, color: t.ink(0.3) }}>{trend.posts} posts</span>
          </div>
          <span style={{ fontSize: 10, color: t.ink(0.4) }}>{trend.category}</span>
          {i < trends.length - 1 && <div style={{ height: 1, background: t.black(0.04), marginTop: 8 }} />}
        </div>
      ))}
    </div>
  );
}

// ── Suggested profiles ────────────────────────────────────────────────────
function SuggestedProfiles({ t }: { t: typeof LIGHT }) {
  const suggestions = [
    { name: "Marie L.", username: "marie_lit", bio: "Passionnée de littérature française" },
    { name: "Thomas R.", username: "thomas_philo", bio: "Doctorant en philosophie" },
    { name: "Léa M.", username: "lea_musique", bio: "Mélomane & critique musicale" },
  ];
  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      {suggestions.map((s) => {
        const tone = avatarTones[(s.name.charCodeAt(0) + s.name.charCodeAt(1)) % avatarTones.length];
        return (
          <div key={s.username} className="flex items-center gap-3" style={{ padding: "6px 0" }}>
            <Avatar initials={s.name.split(" ").map((w) => w[0]).join("")} size={38} {...tone} />
            <div className="min-w-0 flex-1">
              <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{s.name}</p>
              <p className="truncate" style={{ fontSize: 10, color: t.ink(0.4) }}>{s.bio}</p>
            </div>
            <Link href="/explore" style={{ fontSize: 11, padding: "5px 14px", borderRadius: 20, background: ACCENT_GRADIENT, color: LIGHT.cream, fontWeight: 500, textDecoration: "none" }}>
              Suivre
            </Link>
          </div>
        );
      })}
    </div>
  );
}

function WelcomeCard({ onNewPost, t }: { onNewPost: () => void; t: typeof LIGHT }) {
  const card: CSSProperties = { background: t.white, boxShadow: t.warmShadow, borderRadius: 16, padding: 18, border: "none" };
  return (
    <article style={card}>
      <div className="text-center" style={{ padding: "24px 16px" }}>
        <p style={{ fontSize: 28 }}>{"\u{1F44B}"}</p>
        <h3 className="mt-2" style={{ fontSize: 16, fontWeight: 600, color: t.text }}>Bienvenue sur BoredBoard</h3>
        <p className="mx-auto mt-2" style={{ fontSize: 13, color: t.ink(0.5), lineHeight: 1.6, maxWidth: 340 }}>
          Ton feed est vide pour l&apos;instant. Partage un article, une musique ou une réflexion pour commencer.
        </p>
        <button type="button" onClick={onNewPost} className="db-fab mt-4 inline-flex items-center"
          style={{ color: LIGHT.cream, fontSize: 13, fontWeight: 500, padding: "10px 24px", borderRadius: 20, gap: 6 }}>
          <span aria-hidden>+</span> Créer mon premier post
        </button>
      </div>
    </article>
  );
}

type ShortcutTrack = {
  title: string; artist: string | null; album: string | null;
  platform: keyof typeof musicPlatforms | null; artwork: string | null; trackUrl: string | null;
};

const musicPlatforms = {
  "apple-music": { label: "Apple Music", color: "#FC3C44", background: "rgba(252,60,68,0.08)" },
  spotify: { label: "Spotify", color: "#1DB954", background: "rgba(30,215,96,0.08)" },
  deezer: { label: "Deezer", color: "#EF6400", background: "rgba(239,100,0,0.08)" },
  youtube: { label: "YouTube", color: "#FF0000", background: "rgba(255,0,0,0.08)" },
};

function httpsOrNull(v: unknown) { return typeof v === "string" && v.startsWith("https://") ? v : null; }
function textOrNull(v: unknown) { return typeof v === "string" && v.trim() ? v.trim() : null; }

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

function ShortcutTrackCard({ post, track, t }: { post: Post; track: ShortcutTrack; t: typeof LIGHT }) {
  const author = post.profiles;
  const tone = avatarTones[(post.user_id.charCodeAt(0) + post.user_id.charCodeAt(1)) % avatarTones.length];
  const platform = track.platform ? musicPlatforms[track.platform] : null;
  const comment = post.content && !post.content.startsWith("J'écoute") ? post.content : null;
  const [artworkFailed, setArtworkFailed] = useState(false);
  const card: CSSProperties = { background: t.white, boxShadow: t.warmShadow, borderRadius: 16, padding: 18, border: "none" };

  const info = (
    <>
      <span className="flex shrink-0 items-center justify-center overflow-hidden" style={{ width: 56, height: 56, borderRadius: 10, background: "rgba(131,77,255,0.1)" }}>
        {track.artwork && !artworkFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy" src={track.artwork} alt="" width={56} height={56} onError={() => setArtworkFailed(true)} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10 }} />
        ) : (
          <span aria-hidden style={{ fontSize: 24, color: platform?.color ?? "#534AB7" }}>{"\u{1F3B5}"}</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate" style={{ fontSize: 15, fontWeight: 500, color: t.text }}>{track.title}</span>
        {track.artist && <span className="block truncate" style={{ fontSize: 13, color: t.ink(0.5) }}>{track.artist}</span>}
        {track.album && <span className="block truncate" style={{ fontSize: 12, color: t.ink(0.35), fontStyle: "italic" }}>{track.album}</span>}
      </span>
      {platform && (
        <span className="ml-auto shrink-0" style={{ fontSize: 10, borderRadius: 6, padding: "3px 8px", color: platform.color, background: platform.background }}>
          {platform.label}
        </span>
      )}
    </>
  );
  const playerStyle: CSSProperties = { background: t.cream, borderRadius: 12, padding: 14, gap: 14 };

  return (
    <article className="db-card-social" style={card}>
      <CardHeader
        avatar={<Avatar initials={getInitials(author?.name ?? null, author?.username)} size={42} {...tone} />}
        name={author?.name ?? author?.username ?? "Quelqu’un"}
        verb="partage une musique"
        pill={<span className="shrink-0" style={{ fontSize: 10, borderRadius: 10, padding: "2px 8px", background: "rgba(131,77,255,0.08)", color: "#6B3FD4" }}>Musique</span>}
        time={timeAgo(post.created_at)}
        t={t}
      />
      {track.trackUrl ? (
        <a href={track.trackUrl} target="_blank" rel="noopener noreferrer" className="db-action mt-3 flex items-center" style={playerStyle} aria-label={`Écouter ${track.title}`}>
          {info}
        </a>
      ) : (
        <div className="mt-3 flex items-center" style={playerStyle}>{info}</div>
      )}
      {/* Mini player embed */}
      {track.trackUrl && <MiniPlayer url={track.trackUrl} />}
      {comment && (
        <p className="mt-3 whitespace-pre-wrap break-words" style={{ fontSize: 13, color: t.ink(0.6), fontStyle: "italic", lineHeight: 1.6 }}>{comment}</p>
      )}
      <div className="mt-3">
        <Actions postId={post.id} likes={post.likes_count ?? 0} comments={0} extra="↗ Partager" />
      </div>
    </article>
  );
}

function usePostEmbed(post: Post) {
  const stored = post.type === "musique" ? parseEmbed(post.metadata) : null;
  const [embed, setEmbed] = useState<MusicEmbed | null>(stored);
  const needsLookup = post.type === "musique" && !stored && Boolean(post.url);
  useEffect(() => {
    if (!needsLookup || !post.url) return;
    let cancelled = false;
    fetchEmbed(post.url).then((r) => { if (!cancelled) setEmbed(r); }).catch(() => {});
    return () => { cancelled = true; };
  }, [needsLookup, post.url]);
  return embed;
}

function PostCard({ post, t }: { post: Post; t: typeof LIGHT }) {
  const track = post.type === "musique" ? parseShortcutTrack(post.metadata) : null;
  return track ? <ShortcutTrackCard post={post} track={track} t={t} /> : <LinkPostCard post={post} t={t} />;
}

function LinkPostCard({ post, t }: { post: Post; t: typeof LIGHT }) {
  const embed = usePostEmbed(post);
  const hasComment = Boolean(embed && post.content && post.content !== embed.title && !post.content.startsWith("J'écoute"));
  const author = post.profiles;
  const type = postTypes.find((item) => item.value === post.type);
  const category = categories.find((item) => item.label === post.category);
  const link = safeUrl(post.url);
  const tone = avatarTones[(post.user_id.charCodeAt(0) + post.user_id.charCodeAt(1)) % avatarTones.length];
  const card: CSSProperties = { background: t.white, boxShadow: t.warmShadow, borderRadius: 16, padding: 18, border: "none" };

  return (
    <article className="db-card-social" style={card}>
      <CardHeader
        avatar={<Avatar initials={getInitials(author?.name ?? null, author?.username)} size={42} {...tone} />}
        name={author?.name ?? author?.username ?? "Quelqu’un"}
        verb={type?.verb ?? ""}
        pill={
          post.type === "musique" ? <Pill tone="indigo">Musique</Pill>
          : post.category ? <Pill tone={category?.tone ?? "indigo"}>{post.category}</Pill>
          : undefined
        }
        time={timeAgo(post.created_at)}
        t={t}
      />
      {embed ? (
        <>
          {hasComment && (
            <p className="mb-3 mt-2 whitespace-pre-wrap break-words" style={{ fontSize: 13, color: t.ink(0.6), fontStyle: "italic", lineHeight: 1.6 }}>{post.content}</p>
          )}
          <div className={hasComment ? "" : "mt-3"}>
            <SharedMusicCard embed={embed} href={post.url} />
          </div>
          {/* Mini player for music posts with URL */}
          {post.url && <MiniPlayer url={post.url} />}
        </>
      ) : (
        <p className="mt-3 whitespace-pre-wrap break-words" style={{ fontSize: 14, color: t.text, lineHeight: 1.6 }}>{post.content}</p>
      )}
      {/* OG preview for article links */}
      {link && !embed && post.type === "article" && <OgPreviewCard url={link.href} t={t} />}
      {/* Simple link for non-article links without embed */}
      {link && !embed && post.type !== "article" && (
        <a href={link.href} target="_blank" rel="noopener noreferrer"
          className="mt-3 flex items-center truncate hover:underline"
          style={{ background: t.cream, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: t.indigo, gap: 6 }}>
          <span aria-hidden>↗</span>
          <span className="truncate">{link.hostname.replace(/^www\./, "")}<span style={{ color: t.ink(0.4) }}>{link.pathname !== "/" && link.pathname}</span></span>
        </a>
      )}
      <Actions postId={post.id} likes={post.likes_count ?? 0} comments={0} extra="↗ Partager" />
    </article>
  );
}

function SkeletonCard({ t }: { t: typeof LIGHT }) {
  const bar = (width: string, height = 10): CSSProperties => ({ width, height, background: t.surface, borderRadius: 8 });
  const card: CSSProperties = { background: t.white, boxShadow: t.warmShadow, borderRadius: 16, padding: 18, border: "none" };
  return (
    <div aria-hidden className="animate-pulse" style={card}>
      <div className="flex items-center gap-2">
        <span style={{ width: 30, height: 30, background: t.surface, borderRadius: "50%" }} />
        <span style={bar("160px")} />
      </div>
      <div className="mt-4" style={bar("100%", 12)} />
      <div className="mt-2" style={bar("80%", 12)} />
      <div className="mt-2" style={bar("40%", 12)} />
    </div>
  );
}

function NewPostModal({ user, onClose, onCreated, t }: { user: User; onClose: () => void; onCreated: () => void; t: typeof LIGHT }) {
  const [type, setType] = useState<PostType>("article");
  const [url, setUrl] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [musicUrl, setMusicUrl] = useState("");
  const [musicEmbed, setMusicEmbed] = useState<MusicEmbed | null>(null);
  const [musicLoading, setMusicLoading] = useState(false);
  const [musicError, setMusicError] = useState(false);
  const [lookedUp, setLookedUp] = useState("");
  // OG preview for article URL
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
    if (type === "musique" && !musicEmbed) { setError("Ajoute un lien Spotify, Apple Music, Deezer ou YouTube reconnu."); return; }
    const trimmedUrl = type === "article" ? url.trim() : type === "musique" ? musicUrl.trim() : "";
    if (trimmedUrl && !safeUrl(trimmedUrl)) { setError("Le lien doit commencer par http:// ou https://"); return; }
    setSubmitting(true);
    const profileError = await ensureProfile(user);
    if (profileError) { setError(`Ton profil n’a pas pu être créé : ${profileError}`); setSubmitting(false); return; }
    const post: Record<string, unknown> = { user_id: user.id, type, content: content.trim() || (type === "musique" && musicEmbed ? musicEmbed.title : ""), url: trimmedUrl || null, category };
    let { error: insertError } = await supabase.from("posts").insert(type === "musique" ? { ...post, metadata: musicEmbed } : post);
    if (insertError && type === "musique" && /metadata/i.test(insertError.message)) {
      ({ error: insertError } = await supabase.from("posts").insert(post));
    }
    if (insertError) { setError(`La publication a échoué : ${insertError.message}`); setSubmitting(false); return; }
    onCreated();
  };

  const field: CSSProperties = { background: t.cream, border: `1px solid ${t.black(0.08)}`, borderRadius: 10, color: t.text, outline: "none", width: "100%" };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center px-5"
      style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)", WebkitBackdropFilter: "blur(6px)" }} onClick={onClose}>
      <form role="dialog" aria-modal="true" aria-labelledby="new-post-title" onClick={(e) => e.stopPropagation()} onSubmit={handleSubmit}
        className="w-full" style={{ maxWidth: 520, background: t.white, borderRadius: 20, padding: 28, boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
        <div className="flex items-center">
          <h2 id="new-post-title" style={{ fontSize: 16, fontWeight: 600, color: t.text }}>Nouveau post</h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="db-play ml-auto" style={{ fontSize: 18 }}>✕</button>
        </div>

        <div className="mt-4 flex flex-wrap" style={{ gap: 8 }}>
          {postTypes.map((item) => (
            <button key={item.value} type="button" aria-pressed={type === item.value} onClick={() => setType(item.value)}
              className={type === item.value ? "" : "db-chip"}
              style={{ fontSize: 12, padding: "6px 16px", borderRadius: 20, ...(type === item.value ? { background: t.indigo, color: LIGHT.cream } : {}) }}>
              {item.label}
            </button>
          ))}
        </div>

        {type === "article" && (
          <>
            <input type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="Coller une URL..." aria-label="URL de l'article"
              className="db-input mt-3" style={{ ...field, padding: "10px 14px", fontSize: 12 }} />
            {/* OG preview in modal */}
            {ogPreview && ogPreview.title && (
              <div className="mt-2 flex items-center gap-3" style={{ background: t.cream, borderRadius: 10, padding: 10 }}>
                {ogPreview.image && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={ogPreview.image} alt="" style={{ width: 60, height: 44, borderRadius: 6, objectFit: "cover" }}
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: t.text }}>{ogPreview.title}</p>
                  <p className="truncate" style={{ fontSize: 10, color: t.ink(0.4) }}>{ogPreview.domain}</p>
                </div>
              </div>
            )}
          </>
        )}

        {type === "musique" && (
          <div className="mt-3">
            <input type="url" value={musicUrl} onChange={(e) => { setMusicUrl(e.target.value); if (e.target.value.trim() !== lookedUp) { setMusicEmbed(null); setMusicError(false); } }}
              onBlur={(e) => lookUpMusic(e.currentTarget.value)}
              placeholder="Colle un lien Spotify, Apple Music, Deezer ou YouTube" aria-label="Lien de la musique"
              className="db-input" style={{ ...field, padding: "10px 14px", fontSize: 12 }} />
            <p className="mt-1.5" style={{ fontSize: 10, color: t.ink(0.4) }}>{"\u{1F7E2}"} Spotify · {"\u{1F534}"} Apple Music · {"\u{1F7E0}"} Deezer · {"\u{1F534}"} YouTube</p>
            {musicLoading && <p className="mt-2" style={{ fontSize: 11, color: t.ink(0.4) }}>Recherche du morceau…</p>}
            {musicEmbed && !musicLoading && (
              <div className="mt-2">
                <p className="mb-1.5" style={{ fontSize: 11, color: "#16A34A" }}>✓ Musique trouvée</p>
                <SharedMusicCard embed={musicEmbed} href={musicUrl.trim()} />
              </div>
            )}
            {musicError && !musicLoading && (
              <p role="alert" className="mt-2" style={{ fontSize: 11, color: "#DC2626" }}>
                ❌ Lien non reconnu — essaie un lien Spotify, Apple Music, Deezer ou YouTube
              </p>
            )}
          </div>
        )}
        <textarea value={content} onChange={(e) => setContent(e.target.value)}
          placeholder={type === "musique" ? "Dis-nous pourquoi tu partages ça..." : "Ajouter un commentaire..."}
          aria-label="Commentaire" rows={4} autoFocus className="db-input mt-3 block resize-none"
          style={{ ...field, padding: "12px 14px", fontSize: 13, lineHeight: 1.5 }} />

        <p className="mb-2 mt-3" style={{ fontSize: 11, color: t.ink(0.4) }}>Catégorie</p>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {categories.map((item) => {
            const isActive = category === item.label;
            return (
              <button key={item.label} type="button" aria-pressed={isActive} onClick={() => setCategory(isActive ? null : item.label)}
                className={isActive ? "" : "db-chip"} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, ...(isActive ? tones[item.tone] : {}) }}>
                {item.label}
              </button>
            );
          })}
        </div>

        {error && <p role="alert" className="mt-3" style={{ fontSize: 12, color: "#C0392B" }}>{error}</p>}

        <div className="mt-4 flex items-center justify-between gap-3">
          <p style={{ fontSize: 11, color: t.ink(0.4) }}>Visible par tes abonnés</p>
          <button type="submit" disabled={(type === "musique" ? !musicEmbed : content.trim() === "") || submitting}
            className="db-fab disabled:cursor-not-allowed disabled:opacity-50"
            style={{ color: LIGHT.cream, fontSize: 13, fontWeight: 500, padding: "10px 24px", borderRadius: 20 }}>
            {submitting ? "Publication…" : "Publier"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Newsletter article card (shown in the feed) ──────────────────────────
function NewsletterFeedCard({ articles, t }: { articles: NewsletterArticle[]; t: typeof LIGHT }) {
  if (articles.length === 0) return null;
  const card: CSSProperties = { background: t.white, boxShadow: t.warmShadow, borderRadius: 16, padding: 0, border: "none", overflow: "hidden" };
  return (
    <div style={card}>
      <div className="flex items-center gap-2" style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${t.black(0.05)}` }}>
        <span style={{ fontSize: 16 }}>{"\u{1F4EC}"}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: t.text }}>Tes newsletters</span>
        <Link href="/newsletter" className="ml-auto db-hover" style={{ fontSize: 11, color: t.indigo, fontWeight: 500, padding: "2px 8px", borderRadius: 6 }}>
          Gérer →
        </Link>
      </div>
      <div className="flex flex-col" style={{ gap: 0 }}>
        {articles.map((a, i) => (
          <a key={`${a.source_id}-${i}`} href={a.url} target="_blank" rel="noopener noreferrer"
            className="db-hover flex gap-3"
            style={{ padding: "12px 16px", textDecoration: "none", borderBottom: i < articles.length - 1 ? `1px solid ${t.black(0.04)}` : undefined }}>
            <span style={{ width: 36, height: 36, borderRadius: 10, background: a.source_color, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16, flexShrink: 0 }}>
              {a.source_icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: t.text, lineHeight: 1.3 }}>{a.title}</p>
              {a.description && <p className="line-clamp-2" style={{ fontSize: 11, color: t.ink(0.5), lineHeight: 1.4, marginTop: 2 }}>{a.description}</p>}
              <div className="mt-1 flex items-center gap-2">
                <span style={{ fontSize: 10, color: t.ink(0.4) }}>{a.source_name}</span>
                <span style={{ fontSize: 10, color: t.ink(0.3) }}>·</span>
                <span style={{ fontSize: 10, color: t.ink(0.4) }}>{a.theme}</span>
              </div>
            </div>
          </a>
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
  const t = useTheme();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [filter, setFilter] = useState("Tout");
  const [modalOpen, setModalOpen] = useState(false);
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [mine, setMine] = useState<Record<string, MyInteractions>>({});
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [utilityOpen, setUtilityOpen] = useState(false);
  const [following, setFollowing] = useState<PublicProfile[]>([]);
  const [nlArticles, setNlArticles] = useState<NewsletterArticle[]>([]);
  const [podcastSubCount, setPodcastSubCount] = useState(0);

  // Dynamic CSS that uses theme tokens
  const css = `
.db-hover:hover { background: ${t.black(0.04)}; }
.db-action:hover { background: ${t.black(0.05)}; }
.db-pill { background: ${t.black(0.05)}; color: ${t.ink(0.5)}; }
.db-pill:hover { background: ${t.black(0.08)}; }
.db-chip { background: ${t.surface}; color: ${t.ink(0.5)}; }
.db-chip:hover { background: ${t === DARK ? "#243059" : "#EAE3D6"}; }
.db-space { background: ${t.surface}; transition: background-color 0.15s; }
.db-space:hover { background: ${t === DARK ? "#243059" : "#EAE3D6"}; }
.db-option { background: ${t.white}; }
.db-option:hover { background: ${t.black(0.03)}; }
.db-fab { background: ${t === DARK ? "#7B8CDE" : "#2A3560"}; }
.db-fab:hover { background: ${t === DARK ? "#9BA8E8" : "#3D4F8C"}; }
.db-play { color: ${t.ink(0.4)}; }
.db-play:hover { color: ${t.text}; }
.db-input::placeholder { color: ${t.ink(0.4)}; }
.db-noscrollbar { scrollbar-width: none; }
.db-noscrollbar::-webkit-scrollbar { display: none; }
.db-card-social { transition: box-shadow 0.2s ease, transform 0.15s ease; }
.db-card-social:hover { box-shadow: ${t.hoverShadow}; transform: translateY(-1px); }
.db-story-ring { background: ${ACCENT_GRADIENT}; }
.db-compose:focus-within { box-shadow: 0 0 0 2px rgba(42,53,96,0.15); }
.db-trending:hover { background: ${t === DARK ? "rgba(123,140,222,0.08)" : "rgba(42,53,96,0.06)"}; }
${socialCss}
${socialCardsCss}
`;

  useEffect(() => {
    if (!sidebarOpen && !utilityOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setSidebarOpen(false); setUtilityOpen(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen, utilityOpen]);

  useEffect(() => {
    const local = readLocalPreferences();
    if (local) setPreferences(local);
  }, []);

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
    const { data, error } = await supabase
      .from("posts").select(POST_SELECT)
      .not("content", "ilike", "%Morceau actuel%")
      .not("content", "ilike", "%Test du Raccourci%")
      .order("created_at", { ascending: false }).limit(20);
    if (error) { setFeedError(error.message); return; }
    const loaded = data as Post[];
    const { data: auth } = await supabase.auth.getSession();
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
      setProfileError(error);
      const { data } = await supabase.from("profiles").select("name, username, location").eq("id", userId).maybeSingle();
      if (!cancelled) setProfile(data);
      const remote = await readRemotePreferences(userId);
      if (!cancelled && remote) setPreferences(remote);
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

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const subs = await getUserSubscriptions(userId);
      if (cancelled || subs.length === 0) return;
      const sourceIds = subs.map((s) => s.source_id);
      const withFeed = NEWSLETTER_SOURCES.filter((s) => sourceIds.includes(s.id) && s.feed_url);
      if (withFeed.length === 0) return;
      try {
        const res = await fetch(`/api/newsletters?sources=${withFeed.map((s) => s.id).join(",")}`);
        if (!res.ok) return;
        const { articles } = await res.json();
        if (!cancelled) setNlArticles(articles ?? []);
      } catch { /* silent */ }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getUserPodcastSubscriptions(userId).then((list) => { if (!cancelled) setPodcastSubCount(list.length); });
    return () => { cancelled = true; };
  }, [userId]);

  const closeModal = useCallback(() => setModalOpen(false), []);

  const query = themesQuery(preferences.themes);
  const news = useNews(query ? { q: query } : { category: "Actualités" }, preferences.modules.actualites && Boolean(userId));

  const handleSavePreferences = async (next: Preferences) => {
    setPreferences(next);
    const savedOnline = userId ? await savePreferences(userId, next) : false;
    return savedOnline ? "Préférences enregistrées." : "Enregistrées sur cet appareil seulement : la sauvegarde sur ton profil a échoué.";
  };

  if (!session) return <div className="min-h-screen" style={{ background: t.cream }} />;

  const email = session.user.email;
  const displayName = profile?.name ?? email?.split("@")[0] ?? "";
  const username = profile?.username ?? email?.split("@")[0] ?? "";
  const initials = getInitials(profile?.name ?? null, email);

  type FeedItem = { key: string; tags: string[]; node: ReactNode };
  const on = (moduleId: ModuleId) => preferences.modules[moduleId];
  const typeModule: Partial<Record<PostType, ModuleId>> = { article: "actualites", musique: "musique", livre: "livres" };

  const postItems: FeedItem[] = (posts ?? [])
    .filter((post) => { const m = typeModule[post.type]; return !m || on(m); })
    .map((post) => ({ key: post.id, tags: postTags(post), node: <PostCard post={post} t={t} /> }));
  if (postItems.length === 0) {
    postItems.push({ key: "welcome", tags: [], node: <WelcomeCard onNewPost={() => setModalOpen(true)} t={t} /> });
  }

  const moduleItems: Record<string, FeedItem[]> = {};
  if (on("musique")) (moduleItems["musique"] ??= []).push({ key: "listening", tags: ["Musique"], node: <NowListeningCard /> });
  if (on("livres")) (moduleItems["livres"] ??= []).push({ key: "reading", tags: ["Livres"], node: <ReadingNowCard /> });
  if (on("reactions")) (moduleItems["reactions"] ??= []).push({ key: "discussions", tags: [], node: <DiscussionsCard /> });
  if (on("marches")) (moduleItems["marches"] ??= []).push({ key: "markets", tags: ["Actualités"], node: <MarketsFlashCard /> });
  if (on("actualites")) {
    const items: FeedItem[] = [];
    if (news.error) items.push({ key: "news-error", tags: ["Actualités"], node: <NewsError onRetry={news.retry} /> });
    else if (news.loading || !news.articles) items.push({ key: "news-loading", tags: ["Actualités"], node: <NewsSkeleton /> });
    else { for (const article of news.articles.slice(0, NEWS_IN_FEED)) items.push({ key: article.url, tags: ["Actualités"], node: <NewsCard article={article} user={session.user} onShared={loadPosts} /> }); }
    moduleItems["actualites"] = items;
  }

  if (nlArticles.length > 0) {
    (moduleItems["actualites"] ??= []).push({ key: "newsletter-feed", tags: ["Actualités"], node: <NewsletterFeedCard articles={nlArticles.slice(0, 5)} t={t} /> });
  }

  const sortedModuleItems: FeedItem[] = preferences.moduleOrder.flatMap((id) => moduleItems[id] ?? []);
  const discoveryItems: FeedItem[] = [];

  const interleave = (first: FeedItem[], second: FeedItem[]) =>
    Array.from({ length: Math.max(first.length, second.length) }, (_, i) => [first[i], second[i]]).flat().filter((item): item is FeedItem => Boolean(item));

  const feedItems = preferences.order === "social" ? [...postItems, ...sortedModuleItems, ...discoveryItems]
    : preferences.order === "actualites" ? [...sortedModuleItems, ...postItems, ...discoveryItems]
    : [...interleave(postItems, sortedModuleItems), ...discoveryItems];
  const isVisible = (tags: string[]) => filter === "Tout" || tags.includes(filter);
  const hasVisibleItem = feedItems.some((item) => isVisible(item.tags));

  return (
    <SocialContext.Provider value={{ user: session.user, viewerName: profile?.name ?? null, mine }}>
    <div className="flex h-screen flex-col" style={{ background: t.cream, color: t.text, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <style>{css}</style>
      <Navbar />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[260px_1fr_300px]">
        {sidebarOpen && <div aria-hidden className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(28,26,21,0.35)" }} onClick={() => setSidebarOpen(false)} />}
        <aside
          id="db-sidebar"
          className={`${sidebarOpen ? "fixed inset-y-0 left-0 z-50 block w-[280px] max-w-[85vw] shadow-xl" : "hidden"} overflow-y-auto md:static md:z-auto md:block md:w-auto md:max-w-none md:shadow-none`}
          style={{ background: t.white, borderRight: `1px solid ${t.black(0.07)}`, padding: "20px 16px" }}
          onClick={(e) => { if ((e.target as HTMLElement).closest("a, button")) setSidebarOpen(false); }}>
          <button type="button" aria-label="Fermer le menu" className="db-hover mb-3 ml-auto flex md:hidden" style={{ borderRadius: 8, padding: "2px 8px", fontSize: 18, color: t.ink(0.5) }}>✕</button>
          <div style={{ background: t.white, borderRadius: 16, overflow: "hidden", boxShadow: t.warmShadow }}>
            <div style={{ height: 48, background: ACCENT_GRADIENT }} />
            <div style={{ padding: "0 14px 14px", marginTop: -24 }}>
              <Avatar initials={initials} size={48} background={t.indigo} color={t.cream} />
              <p className="mt-2 truncate" style={{ fontSize: 14, fontWeight: 600, color: t.text }}>{displayName}</p>
              <p className="truncate" style={{ fontSize: 11, color: t.ink(0.4) }}>@{username}{profile?.location && ` · ${profile.location}`}</p>
              <Link href="/profile" className="db-hover mt-2 block w-full text-center"
                style={{ border: `1px solid ${t.black(0.08)}`, borderRadius: 8, fontSize: 11, padding: "5px 10px", color: t.ink(0.5) }}>
                Voir mon profil
              </Link>
            </div>
          </div>
          <Divider t={t} />
          <nav className="flex flex-col" style={{ gap: 2 }}>
            {navItems.map((item) => {
              const isActive = item.filter === filter;
              const style: CSSProperties = { padding: "8px 12px", borderRadius: 10, fontSize: 13, gap: 10, color: isActive ? t.text : t.ink(0.5), fontWeight: isActive ? 500 : 400, ...(isActive ? { background: t.surface } : {}) };
              const className = `flex items-center text-left ${isActive ? "" : "db-hover"}`;
              const content = <><span aria-hidden>{item.icon}</span>{item.label}</>;
              return item.href ? (
                <Link key={item.label} href={item.href} className={className} style={style}>{content}</Link>
              ) : (
                <button key={item.label} type="button" onClick={() => item.filter && setFilter(item.filter)} aria-current={isActive ? "page" : undefined} className={className} style={style}>{content}</button>
              );
            })}
          </nav>
          <Divider t={t} />
          <SectionLabel t={t}>Abonnements</SectionLabel>
          {following.length > 0 ? (
            <div className="flex flex-col" style={{ gap: 6 }}>
              {following.slice(0, 6).map((u) => {
                const tone = avatarTones[(u.id.charCodeAt(0) + u.id.charCodeAt(1)) % avatarTones.length];
                return (
                  <Link key={u.id} href={`/profile?id=${u.id}`} className="db-hover flex items-center" style={{ gap: 8, padding: "4px 8px", borderRadius: 8 }}>
                    <Avatar initials={getInitials(u.name, u.username)} size={26} {...tone} />
                    <span className="min-w-0 truncate" style={{ fontSize: 12, color: t.text }}>{u.name ?? u.username}</span>
                  </Link>
                );
              })}
              {following.length > 6 && <Link href="/explore" style={{ fontSize: 11, color: t.indigo, padding: "2px 8px" }}>Voir tous ({following.length}) →</Link>}
            </div>
          ) : (
            <p style={{ fontSize: 11, color: t.ink(0.4), lineHeight: 1.5 }}><Link href="/explore" style={{ color: t.indigo }}>Découvre des profils</Link> à suivre.</p>
          )}
          <Divider t={t} />
          <SectionLabel t={t}>Qui est en ligne</SectionLabel>
          <p style={{ fontSize: 11, color: t.ink(0.4), lineHeight: 1.5 }}>{following.length > 0 ? "Aucun abonné en ligne pour le moment." : "Suis des profils pour voir leur activité ici."}</p>
          <Divider t={t} />
          <SectionLabel t={t}>Mes espaces</SectionLabel>
          <div className="grid grid-cols-2" style={{ gap: 6 }}>
            {spaces.map((space) => {
              const content = <><span aria-hidden style={{ fontSize: 16 }}>{space.icon}</span><span className="mt-1 block" style={{ fontSize: 11, fontWeight: 500, color: t.text }}>{space.title}</span><span className="block" style={{ fontSize: 10, color: t.ink(0.4) }}>{space.detail}</span></>;
              const style: CSSProperties = { borderRadius: 10, padding: 10 };
              return space.href ? (
                <Link key={space.title} href={space.href} className="db-space block" style={style}>{content}</Link>
              ) : (
                <button key={space.title} type="button" onClick={() => space.filter && setFilter(space.filter)} className="db-space text-left" style={style}>{content}</button>
              );
            })}
          </div>
        </aside>

        {/* Feed */}
        <div className="relative min-h-0 min-w-0">
          <main className="mx-auto flex h-full w-full flex-col overflow-y-auto px-3 md:px-5" style={{ background: t.cream, paddingBottom: 96, gap: 12, maxWidth: 740 }}>
            <div className="sticky top-0 z-10 mb-2 shrink-0" style={{ background: t.cream, paddingTop: 20, paddingBottom: 12, borderBottom: `1px solid ${t.black(0.06)}` }}>
              <div className="db-noscrollbar flex overflow-x-auto" style={{ gap: 6 }}>
                <button type="button" onClick={() => setSidebarOpen(true)} aria-label="Ouvrir le menu" aria-expanded={sidebarOpen} aria-controls="db-sidebar"
                  className="db-hover flex shrink-0 items-center md:hidden"
                  style={{ border: `1px solid ${t.black(0.1)}`, borderRadius: 20, padding: "3px 12px", fontSize: 16, color: t.ink(0.6) }}>☰</button>
                {filters.map((item) => (
                  <button key={item} type="button" onClick={() => setFilter(item)} aria-pressed={filter === item}
                    className={`shrink-0 ${filter === item ? "" : "db-pill"}`}
                    style={{ fontSize: 12, padding: "5px 14px", borderRadius: 20, ...(filter === item ? { background: t.indigo, color: LIGHT.cream } : {}) }}>{item}</button>
                ))}
                <button type="button" onClick={() => setCustomizerOpen(true)} className="db-hover ml-auto flex shrink-0 items-center"
                  style={{ gap: 5, border: `1px solid ${t.black(0.1)}`, borderRadius: 20, padding: "5px 14px", fontSize: 12, color: t.ink(0.5) }}>
                  <span aria-hidden>⚙️</span> Personnaliser
                </button>
              </div>
            </div>

            {following.length > 0 && (
              <FadeIn>
                <div style={{ background: t.white, boxShadow: t.warmShadow, borderRadius: 16, padding: "14px 16px", border: "none", marginBottom: 4 }}>
                  <StoriesBar following={following} posts={posts} t={t} />
                </div>
              </FadeIn>
            )}

            <FadeIn>
              <ComposePrompt initials={initials} displayName={displayName} onOpen={() => setModalOpen(true)} t={t} />
            </FadeIn>

            {profileError && <p role="alert" style={{ background: t.white, boxShadow: t.warmShadow, borderRadius: 16, padding: 18, border: "none", fontSize: 12, color: "#C0392B" }}>Ton profil n&apos;a pas pu être créé : {profileError}</p>}

            {feedError ? (
              <div role="alert" className="text-center" style={{ background: t.white, boxShadow: t.warmShadow, borderRadius: 16, padding: "40px 20px", border: "none" }}>
                <p style={{ fontSize: 15, fontWeight: 500, color: t.text }}>Impossible de charger le feed</p>
                <p className="mt-1.5" style={{ fontSize: 12, color: "#C0392B" }}>{feedError}</p>
                <button type="button" onClick={loadPosts} className="db-hover mt-4"
                  style={{ border: `1px solid ${t.black(0.1)}`, borderRadius: 8, fontSize: 12, padding: "6px 16px", color: t.ink(0.6) }}>Réessayer</button>
              </div>
            ) : posts === null ? (
              <>
                <span className="sr-only" role="status">Chargement du feed…</span>
                <SkeletonCard t={t} /><SkeletonCard t={t} /><SkeletonCard t={t} />
              </>
            ) : (
              <>
                {feedItems.map((item) => (
                  <div key={item.key} hidden={!isVisible(item.tags)} className="shrink-0">
                    <FadeIn>{item.node}</FadeIn>
                  </div>
                ))}
                {!hasVisibleItem && (
                  <p className="text-center" style={{ border: `1px dashed ${t.black(0.12)}`, borderRadius: 14, padding: "40px 20px", fontSize: 13, color: t.ink(0.4) }}>
                    {feedItems.length === 0 ? "Tous les modules sont désactivés : réactive-en depuis « Personnaliser »." : `Rien dans « ${filter} » pour l’instant.`}
                  </p>
                )}
              </>
            )}
          </main>

          <button type="button" onClick={() => setUtilityOpen(true)} aria-label="Ouvrir le panneau utilitaire"
            className="db-hover absolute bottom-6 right-[72px] z-20 flex items-center justify-center md:hidden"
            style={{ background: t.white, width: 40, height: 40, borderRadius: "50%", fontSize: 16, border: `1px solid ${t.black(0.1)}`, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}>⚡</button>
          <button type="button" onClick={() => setModalOpen(true)} aria-label="Nouveau post" title="Nouveau post"
            className="db-fab absolute bottom-6 right-6 z-20 flex items-center justify-center"
            style={{ color: LIGHT.cream, width: 48, height: 48, borderRadius: "50%", fontSize: 22, boxShadow: "0 4px 20px rgba(42,53,96,0.3)" }}>+</button>
        </div>

        {/* Right sidebar */}
        <aside className="hidden overflow-y-auto md:block" style={{ background: t.white, borderLeft: `1px solid ${t.black(0.04)}`, padding: "20px 16px" }}>
          <div className="flex items-center" style={{ gap: 6, marginBottom: 16 }}>
            {[
              { icon: "✏️", value: String(posts?.length ?? 0), label: "posts" },
              { icon: "\u{1F3B5}", value: String((posts ?? []).filter((p) => p.type === "musique").length), label: "musiques" },
              { icon: "\u{1F4D6}", value: String((posts ?? []).filter((p) => p.type === "livre").length), label: "livres" },
            ].map((stat) => (
              <div key={stat.label} className="flex-1 text-center" style={{ background: t.cream, borderRadius: 12, padding: "8px 4px" }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: t.text, lineHeight: 1 }}>{stat.value}</p>
                <p style={{ fontSize: 9, color: t.ink(0.4), marginTop: 2 }}>{stat.label}</p>
              </div>
            ))}
          </div>
          <SectionLabel t={t}>{"\u{1F525}"} Tendances</SectionLabel>
          <TrendingTopics posts={posts} t={t} />
          <Divider t={t} />
          <SectionLabel t={t}>Profils suggérés</SectionLabel>
          <SuggestedProfiles t={t} />
          <Divider t={t} />
          <SectionLabel t={t}>Raccourcis</SectionLabel>
          <div className="grid grid-cols-3" style={{ gap: 6 }}>
            {[
              { icon: "\u{1F4EC}", label: "Newsletters", href: "/newsletter" },
              { icon: "\u{1F399}", label: "Podcasts", href: "/podcasts" },
              { icon: "\u{1F4D6}", label: "Livres", href: "/livres" },
              { icon: "\u{1F9ED}", label: "Explorer", href: "/explore" },
              { icon: "\u{1F4F0}", label: "Actus", href: "/actualites" },
              { icon: "⚙️", label: "Réglages", href: "/settings" },
            ].map((link) => (
              <Link key={link.label} href={link.href} className="db-hover flex flex-col items-center"
                style={{ background: t.cream, padding: "10px 4px", borderRadius: 12, fontSize: 10, gap: 3, color: t.ink(0.6), textDecoration: "none" }}>
                <span aria-hidden style={{ fontSize: 16 }}>{link.icon}</span>{link.label}
              </Link>
            ))}
          </div>
          <Divider t={t} />
          <SectionLabel t={t}>Mes thèmes</SectionLabel>
          <div className="flex flex-wrap" style={{ gap: 5 }}>
            {(preferences.themes.length > 0 ? preferences.themes : ["Aucun thème sélectionné"]).map((theme) => (
              <span key={theme} style={{
                background: preferences.themes.length > 0 ? "rgba(42,53,96,0.07)" : "transparent",
                color: preferences.themes.length > 0 ? t.indigo : t.ink(0.4), fontSize: 11, borderRadius: 20, padding: "4px 12px" }}>{theme}</span>
            ))}
          </div>
          <button type="button" onClick={() => setCustomizerOpen(true)} className="db-hover mt-2 w-full"
            style={{ border: `1px solid ${t.black(0.08)}`, borderRadius: 8, fontSize: 11, padding: 6, color: t.ink(0.6) }}>Personnaliser</button>
          <Divider t={t} />
          <div className="flex flex-col" style={{ gap: 8 }}>
            <Link href="/newsletter" style={{ textDecoration: "none" }}>
              <div className="db-hover flex items-center gap-3" style={{ background: t.cream, borderRadius: 12, padding: 12, cursor: "pointer" }}>
                <span style={{ fontSize: 20 }}>{"\u{1F4EC}"}</span>
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: 12, fontWeight: 500, color: t.text }}>Newsletters</p>
                  <p style={{ fontSize: 10, color: t.ink(0.4) }}>Culturelles françaises</p>
                </div>
                <span style={{ fontSize: 11, color: t.indigo }}>→</span>
              </div>
            </Link>
            <Link href="/podcasts" style={{ textDecoration: "none" }}>
              <div className="db-hover flex items-center gap-3" style={{ background: t.cream, borderRadius: 12, padding: 12, cursor: "pointer" }}>
                <span style={{ fontSize: 20 }}>{"\u{1F399}"}</span>
                <div className="min-w-0 flex-1">
                  <p style={{ fontSize: 12, fontWeight: 500, color: t.text }}>Podcasts{podcastSubCount > 0 ? ` · ${podcastSubCount}` : ""}</p>
                  <p style={{ fontSize: 10, color: t.ink(0.4) }}>Découvrir & écouter</p>
                </div>
                <span style={{ fontSize: 11, color: t.indigo }}>→</span>
              </div>
            </Link>
          </div>
        </aside>
      </div>

      {modalOpen && <NewPostModal user={session.user} onClose={closeModal} onCreated={() => { setModalOpen(false); loadPosts(); }} t={t} />}
      {customizerOpen && <Customizer initial={preferences} onClose={() => setCustomizerOpen(false)} onSave={handleSavePreferences} />}

      {utilityOpen && (
        <>
          <div aria-hidden className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(28,26,21,0.35)" }} onClick={() => setUtilityOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label="Panneau utilitaire"
            className="fixed inset-x-0 bottom-0 z-50 md:hidden"
            style={{ background: t.white, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "75vh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.12)" }}>
            <div className="flex items-center justify-between" style={{ padding: "16px 20px 8px", borderBottom: `1px solid ${t.black(0.06)}` }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: t.text }}>⚡ Utilitaires</span>
              <button type="button" onClick={() => setUtilityOpen(false)} aria-label="Fermer" className="db-play" style={{ fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: "12px 20px 24px" }}>
              <div className="grid grid-cols-4" style={{ gap: 8, marginBottom: 16 }}>
                {[
                  { icon: "✏️", value: String(posts?.length ?? 0), label: "posts" },
                  { icon: "\u{1F3B5}", value: String((posts ?? []).filter((p) => p.type === "musique").length), label: "musiques" },
                  { icon: "\u{1F4D6}", value: String((posts ?? []).filter((p) => p.type === "livre").length), label: "livres" },
                  { icon: "\u{1F4AC}", value: String((posts ?? []).filter((p) => p.type === "reflexion").length), label: "réflexions" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center" style={{ background: t.cream, borderRadius: 10, padding: "10px 4px" }}>
                    <p style={{ fontSize: 14 }} aria-hidden>{stat.icon}</p>
                    <p style={{ fontSize: 16, fontWeight: 600, color: t.text, lineHeight: 1.2 }}>{stat.value}</p>
                    <p style={{ fontSize: 9, color: t.ink(0.4) }}>{stat.label}</p>
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-2" style={{ gap: 8 }}>
                {[
                  { icon: "➕", label: "Nouveau post", action: () => { setUtilityOpen(false); setModalOpen(true); } },
                  { icon: "⚙️", label: "Personnaliser", action: () => { setUtilityOpen(false); setCustomizerOpen(true); } },
                ].map((s) => (
                  <button key={s.label} type="button" onClick={s.action} className="db-hover flex items-center justify-center"
                    style={{ background: t.cream, padding: "12px 10px", borderRadius: 12, fontSize: 12, gap: 6, color: t.ink(0.6) }}>
                    <span aria-hidden>{s.icon}</span>{s.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-3" style={{ gap: 8 }}>
                {[
                  { icon: "\u{1F9ED}", label: "Explorer", href: "/explore" },
                  { icon: "\u{1F464}", label: "Profil", href: "/profile" },
                  { icon: "\u{1F527}", label: "Paramètres", href: "/settings" },
                ].map((link) => (
                  <Link key={link.label} href={link.href} onClick={() => setUtilityOpen(false)} className="db-hover flex flex-col items-center"
                    style={{ background: t.cream, padding: "12px 8px", borderRadius: 12, fontSize: 11, gap: 4, color: t.ink(0.6) }}>
                    <span aria-hidden style={{ fontSize: 16 }}>{link.icon}</span>{link.label}
                  </Link>
                ))}
              </div>
              {preferences.themes.length > 0 && (
                <div className="mt-4">
                  <p style={{ fontSize: 9, color: t.ink(0.35), letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 400, marginBottom: 8 }}>Mes thèmes</p>
                  <div className="flex flex-wrap" style={{ gap: 5 }}>
                    {preferences.themes.map((theme) => <span key={theme} style={{ background: "rgba(42,53,96,0.07)", color: t.indigo, fontSize: 11, borderRadius: 20, padding: "4px 12px" }}>{theme}</span>)}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
    </SocialContext.Provider>
  );
}

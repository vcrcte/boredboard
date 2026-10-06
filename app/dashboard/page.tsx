"use client";

import {
  useCallback,
  useEffect,
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
import { getUserPodcastSubscriptions, PODCAST_SOURCES } from "@/lib/podcasts";
import { getFollowing, type PublicProfile } from "@/lib/social";
import { supabase } from "@/lib/supabase";

const CREAM = "#F7F4EE";
const SURFACE = "#F0EBE1";
const INDIGO = "#2A3560";
const TEXT = "#1C1A15";
const WHITE = "#FFFFFF";

const ink = (alpha: number) => `rgba(28,26,21,${alpha})`;
const black = (alpha: number) => `rgba(0,0,0,${alpha})`;
const DIM = ink(0.4);

// Hover states can't be expressed as inline styles; an inline background would
// also override them, so hoverable elements get their base colour here too.
const css = `
.db-hover:hover { background: ${black(0.04)}; }
.db-action:hover { background: ${black(0.05)}; }
.db-pill { background: ${black(0.05)}; color: ${ink(0.5)}; }
.db-pill:hover { background: ${black(0.08)}; }
.db-chip { background: ${SURFACE}; color: ${ink(0.5)}; }
.db-chip:hover { background: #EAE3D6; }
.db-space { background: ${SURFACE}; transition: background-color 0.15s; }
.db-space:hover { background: #EAE3D6; }
.db-option { background: ${WHITE}; }
.db-option:hover { background: ${black(0.03)}; }
.db-fab { background: ${INDIGO}; }
.db-fab:hover { background: #3D4F8C; }
.db-play { color: ${DIM}; }
.db-play:hover { color: ${TEXT}; }
.db-input::placeholder { color: ${DIM}; }
.db-noscrollbar { scrollbar-width: none; }
.db-noscrollbar::-webkit-scrollbar { display: none; }
${socialCss}
${socialCardsCss}
`;

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
  /** Music link details (see lib/music.ts); only once the metadata column exists. */
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

// Recommended articles shown in the feed when the news module is on.
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

// Navigation entries and spaces either filter the feed or link to a page;
// those with neither have no destination yet.
const navItems: { icon: string; label: string; filter?: string; href?: string }[] = [
  { icon: "🏠", label: "Mon espace", filter: "Tout" },
  { icon: "🧭", label: "Explorer", href: "/explore" },
  { icon: "🎵", label: "Musique", filter: "Musique" },
  { icon: "📖", label: "Livres", href: "/livres" },
  { icon: "✉️", label: "Newsletter", href: "/newsletter" },
];

const spaces: { icon: string; title: string; detail: string; filter?: string; href?: string }[] = [
  { icon: "🎵", title: "Musique", detail: "4 titres", filter: "Musique" },
  { icon: "📖", title: "Livres", detail: "en cours", href: "/livres" },
  { icon: "🎙", title: "Podcasts", detail: "favoris", href: "/podcasts" },
];



const card: CSSProperties = {
  background: WHITE,
  border: `1px solid ${black(0.07)}`,
  borderRadius: 14,
  padding: 16,
};

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

// Only http(s) links are rendered, so a stored `javascript:` URL can't run.
function safeUrl(url: string | null) {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed : null;
  } catch {
    return null;
  }
}

function postTags(post: Post) {
  const tags = [postTypes.find((type) => type.value === post.type)?.filter];
  tags.push(categories.find((category) => category.label === post.category)?.filter);
  return tags.filter((tag): tag is string => Boolean(tag));
}

function Avatar({
  initials,
  size,
  background,
  color,
}: {
  initials: string;
  size: number;
  background: string;
  color: string;
}) {
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

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h2 className="mb-3" style={{ fontSize: 9, color: ink(0.35), letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 400 }}>
      {children}
    </h2>
  );
}

function Divider() {
  return <div className="my-4" style={{ height: 1, background: black(0.06) }} />;
}

function CardHeader({
  avatar,
  name,
  verb,
  pill,
  time,
}: {
  avatar: ReactNode;
  name: string;
  verb: string;
  pill?: ReactNode;
  time?: string;
}) {
  return (
    <div className="flex items-center gap-2">
      {avatar}
      <p className="min-w-0 truncate" style={{ fontSize: 12 }}>
        <span style={{ fontWeight: 500, color: TEXT }}>{name}</span>{" "}
        <span style={{ color: DIM }}>{verb}</span>
      </p>
      <span className="ml-auto flex shrink-0 items-center gap-2">
        {pill}
        {time && <span style={{ fontSize: 11, color: DIM }}>{time}</span>}
      </span>
    </div>
  );
}


function WelcomeCard({ onNewPost }: { onNewPost: () => void }) {
  return (
    <article style={card}>
      <div className="text-center" style={{ padding: "24px 16px" }}>
        <p style={{ fontSize: 28 }}>👋</p>
        <h3 className="mt-2" style={{ fontSize: 16, fontWeight: 600, color: TEXT }}>
          Bienvenue sur BoredBoard
        </h3>
        <p className="mx-auto mt-2" style={{ fontSize: 13, color: ink(0.5), lineHeight: 1.6, maxWidth: 340 }}>
          Ton feed est vide pour l&apos;instant. Partage un article, une musique ou une réflexion pour commencer.
        </p>
        <button
          type="button"
          onClick={onNewPost}
          className="db-fab mt-4 inline-flex items-center"
          style={{ color: CREAM, fontSize: 13, fontWeight: 500, padding: "10px 24px", borderRadius: 20, gap: 6 }}
        >
          <span aria-hidden>+</span> Créer mon premier post
        </button>
      </div>
    </article>
  );
}


/** What the Apple Shortcut saves with a post (app/api/shortcuts/music/route.ts). */
type ShortcutTrack = {
  title: string;
  artist: string | null;
  album: string | null;
  platform: keyof typeof musicPlatforms | null;
  artwork: string | null;
  trackUrl: string | null;
};

const musicPlatforms = {
  "apple-music": { label: "Apple Music", color: "#FC3C44", background: "rgba(252,60,68,0.08)" },
  spotify: { label: "Spotify", color: "#1DB954", background: "rgba(30,215,96,0.08)" },
  deezer: { label: "Deezer", color: "#EF6400", background: "rgba(239,100,0,0.08)" },
  youtube: { label: "YouTube", color: "#FF0000", background: "rgba(255,0,0,0.08)" },
};

function httpsOrNull(value: unknown) {
  return typeof value === "string" && value.startsWith("https://") ? value : null;
}

function textOrNull(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/** Shortcut posts only: link posts carry an embed_url and use the player card. */
function parseShortcutTrack(value: unknown): ShortcutTrack | null {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : null;
  const title = textOrNull(raw?.title);
  if (!raw || !title || "embed_url" in raw) return null;
  // Shortcuts send "apple", "apple music" or "apple-music": compare letters only.
  const key = String(raw.platform ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const platform =
    key === "apple" || key === "applemusic"
      ? "apple-music"
      : key === "spotify" || key === "deezer" || key === "youtube"
        ? key
        : key === "youtubemusic"
          ? "youtube"
          : null;
  return {
    title,
    artist: textOrNull(raw.artist),
    album: textOrNull(raw.album),
    platform,
    artwork: httpsOrNull(raw.artwork),
    trackUrl: httpsOrNull(raw.trackUrl),
  };
}

function ShortcutTrackCard({ post, track }: { post: Post; track: ShortcutTrack }) {
  const author = post.profiles;
  const tone = avatarTones[(post.user_id.charCodeAt(0) + post.user_id.charCodeAt(1)) % avatarTones.length];
  const platform = track.platform ? musicPlatforms[track.platform] : null;
  // Without a comment the Shortcut stores "J'écoute …": no need to repeat the title.
  const comment = post.content && !post.content.startsWith("J'écoute") ? post.content : null;
  // An artwork link that no longer loads falls back to the music icon.
  const [artworkFailed, setArtworkFailed] = useState(false);

  const info = (
    <>
      <span className="flex shrink-0 items-center justify-center overflow-hidden" style={{ width: 56, height: 56, borderRadius: 10, background: "rgba(131,77,255,0.1)" }}>
        {track.artwork && !artworkFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img loading="lazy" src={track.artwork} alt="" width={56} height={56} onError={() => setArtworkFailed(true)} style={{ width: 56, height: 56, objectFit: "cover", borderRadius: 10 }} />
        ) : (
          <span aria-hidden style={{ fontSize: 24, color: platform?.color ?? "#534AB7" }}>🎵</span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate" style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>{track.title}</span>
        {track.artist && <span className="block truncate" style={{ fontSize: 13, color: ink(0.5) }}>{track.artist}</span>}
        {track.album && <span className="block truncate" style={{ fontSize: 12, color: ink(0.35), fontStyle: "italic" }}>{track.album}</span>}
      </span>
      {platform && (
        <span className="ml-auto shrink-0" style={{ fontSize: 10, borderRadius: 6, padding: "3px 8px", color: platform.color, background: platform.background }}>
          {platform.label}
        </span>
      )}
    </>
  );
  const playerStyle: CSSProperties = { background: CREAM, borderRadius: 12, padding: 14, gap: 14 };

  return (
    <article className="db-card" style={card}>
      <CardHeader
        avatar={<Avatar initials={getInitials(author?.name ?? null, author?.username)} size={30} {...tone} />}
        name={author?.name ?? author?.username ?? "Quelqu'un"}
        verb="partage une musique"
        pill={<span className="shrink-0" style={{ fontSize: 10, borderRadius: 10, padding: "2px 8px", background: "rgba(131,77,255,0.08)", color: "#6B3FD4" }}>Musique</span>}
        time={timeAgo(post.created_at)}
      />
      {track.trackUrl ? (
        <a href={track.trackUrl} target="_blank" rel="noopener noreferrer" className="db-action mt-3 flex items-center" style={playerStyle} aria-label={`Écouter ${track.title}`}>
          {info}
        </a>
      ) : (
        <div className="mt-3 flex items-center" style={playerStyle}>{info}</div>
      )}
      {comment && (
        <p className="mt-3 whitespace-pre-wrap break-words" style={{ fontSize: 13, color: ink(0.6), fontStyle: "italic", lineHeight: 1.6 }}>
          {comment}
        </p>
      )}
      <div className="mt-3">
        <Actions postId={post.id} likes={post.likes_count ?? 0} comments={0} extra="↗ Partager" />
      </div>
    </article>
  );
}

/** Metadata saved with the post, or looked up again from its link (posts made before the metadata column). */
function usePostEmbed(post: Post) {
  const stored = post.type === "musique" ? parseEmbed(post.metadata) : null;
  const [embed, setEmbed] = useState<MusicEmbed | null>(stored);
  const needsLookup = post.type === "musique" && !stored && Boolean(post.url);

  useEffect(() => {
    if (!needsLookup || !post.url) return;
    let cancelled = false;
    fetchEmbed(post.url)
      .then((result) => {
        if (!cancelled) setEmbed(result);
      })
      .catch(() => {
        // Unknown link: the post falls back to the plain link row.
      });
    return () => {
      cancelled = true;
    };
  }, [needsLookup, post.url]);

  return embed;
}

function PostCard({ post }: { post: Post }) {
  const track = post.type === "musique" ? parseShortcutTrack(post.metadata) : null;
  return track ? <ShortcutTrackCard post={post} track={track} /> : <LinkPostCard post={post} />;
}

function LinkPostCard({ post }: { post: Post }) {
  const embed = usePostEmbed(post);
  // Links shared from the Shortcut are stored as "J'écoute …": not a comment either.
  const hasComment = Boolean(embed && post.content && post.content !== embed.title && !post.content.startsWith("J'écoute"));
  const author = post.profiles;
  const type = postTypes.find((item) => item.value === post.type);
  const category = categories.find((item) => item.label === post.category);
  const link = safeUrl(post.url);
  // A stable colour per author, picked from their id.
  const tone = avatarTones[(post.user_id.charCodeAt(0) + post.user_id.charCodeAt(1)) % avatarTones.length];

  return (
    <article className="db-card" style={card}>
      <CardHeader
        avatar={<Avatar initials={getInitials(author?.name ?? null, author?.username)} size={30} {...tone} />}
        name={author?.name ?? author?.username ?? "Quelqu'un"}
        verb={type?.verb ?? ""}
        pill={
          post.type === "musique" ? (
            <Pill tone="indigo">Musique</Pill>
          ) : post.category ? (
            <Pill tone={category?.tone ?? "indigo"}>{post.category}</Pill>
          ) : undefined
        }
        time={timeAgo(post.created_at)}
      />
      {embed ? (
        <>
          {/* Without a comment the title is stored as content: no need to repeat it. */}
          {hasComment && (
            <p className="mb-3 mt-2 whitespace-pre-wrap break-words" style={{ fontSize: 13, color: ink(0.6), fontStyle: "italic", lineHeight: 1.6 }}>
              {post.content}
            </p>
          )}
          <div className={hasComment ? "" : "mt-3"}>
            <SharedMusicCard embed={embed} href={post.url} />
          </div>
        </>
      ) : (
        <p className="mt-3 whitespace-pre-wrap break-words" style={{ fontSize: 14, color: TEXT, lineHeight: 1.6 }}>
          {post.content}
        </p>
      )}
      {link && !embed && (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 flex items-center truncate hover:underline"
          style={{ background: CREAM, borderRadius: 10, padding: "8px 12px", fontSize: 12, color: INDIGO, gap: 6 }}
        >
          <span aria-hidden>↗</span>
          <span className="truncate">
            {link.hostname.replace(/^www\./, "")}
            <span style={{ color: DIM }}>{link.pathname !== "/" && link.pathname}</span>
          </span>
        </a>
      )}
      <Actions postId={post.id} likes={post.likes_count ?? 0} comments={0} extra="↗ Partager" />
    </article>
  );
}

function SkeletonCard() {
  const bar = (width: string, height = 10): CSSProperties => ({ width, height, background: SURFACE, borderRadius: 8 });
  return (
    <div aria-hidden className="animate-pulse" style={card}>
      <div className="flex items-center gap-2">
        <span style={{ width: 30, height: 30, background: SURFACE, borderRadius: "50%" }} />
        <span style={bar("160px")} />
      </div>
      <div className="mt-4" style={bar("100%", 12)} />
      <div className="mt-2" style={bar("80%", 12)} />
      <div className="mt-2" style={bar("40%", 12)} />
    </div>
  );
}

function NewPostModal({
  user,
  onClose,
  onCreated,
}: {
  user: User;
  onClose: () => void;
  onCreated: () => void;
}) {
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
  // The link the current embed was looked up for, so editing it invalidates the preview.
  const [lookedUp, setLookedUp] = useState("");

  // Reads the field itself: on a quick paste-and-leave, the state may not be updated yet.
  const lookUpMusic = async (value: string) => {
    const link = value.trim();
    if (!link || link === lookedUp) return;
    setLookedUp(link);
    setMusicLoading(true);
    setMusicError(false);
    try {
      setMusicEmbed(await fetchEmbed(link));
    } catch {
      setMusicEmbed(null);
      setMusicError(true);
    } finally {
      setMusicLoading(false);
    }
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);

    if (type === "musique" && !musicEmbed) {
      setError("Ajoute un lien Spotify, Apple Music, Deezer ou YouTube reconnu.");
      return;
    }
    const trimmedUrl = type === "article" ? url.trim() : type === "musique" ? musicUrl.trim() : "";
    if (trimmedUrl && !safeUrl(trimmedUrl)) {
      setError("Le lien doit commencer par http:// ou https://");
      return;
    }

    setSubmitting(true);

    // posts.user_id references profiles, so the profile must exist first.
    const profileError = await ensureProfile(user);
    if (profileError) {
      setError(`Ton profil n'a pas pu être créé : ${profileError}`);
      setSubmitting(false);
      return;
    }

    const post: Record<string, unknown> = {
      user_id: user.id,
      type,
      // content is required: a music share without a comment stores the track title.
      content: content.trim() || (type === "musique" && musicEmbed ? musicEmbed.title : ""),
      url: trimmedUrl || null,
      category,
    };
    let { error: insertError } = await supabase
      .from("posts")
      .insert(type === "musique" ? { ...post, metadata: musicEmbed } : post);
    // Before the metadata column exists, publish without it: the feed looks the link up again.
    if (insertError && type === "musique" && /metadata/i.test(insertError.message)) {
      ({ error: insertError } = await supabase.from("posts").insert(post));
    }

    if (insertError) {
      setError(`La publication a échoué : ${insertError.message}`);
      setSubmitting(false);
      return;
    }

    onCreated();
  };

  const field: CSSProperties = {
    background: CREAM,
    border: `1px solid ${black(0.08)}`,
    borderRadius: 10,
    color: TEXT,
    outline: "none",
    width: "100%",
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center px-5"
      style={{ background: black(0.4), backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-post-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full"
        style={{ maxWidth: 480, background: WHITE, borderRadius: 20, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
      >
        <div className="flex items-center">
          <h2 id="new-post-title" style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>
            Nouveau post
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="db-play ml-auto" style={{ fontSize: 16 }}>
            ✕
          </button>
        </div>

        <div className="mt-3 flex flex-wrap" style={{ gap: 8 }}>
          {postTypes.map((item) => (
            <button
              key={item.value}
              type="button"
              aria-pressed={type === item.value}
              onClick={() => setType(item.value)}
              className={type === item.value ? "" : "db-chip"}
              style={{
                fontSize: 12,
                padding: "5px 14px",
                borderRadius: 20,
                ...(type === item.value ? { background: INDIGO, color: CREAM } : {}),
              }}
            >
              {item.label}
            </button>
          ))}
        </div>

        {type === "article" && (
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Coller une URL..."
            aria-label="URL de l'article"
            className="db-input mt-3"
            style={{ ...field, padding: "10px 14px", fontSize: 12 }}
          />
        )}
        {type === "musique" && (
          <div className="mt-3">
            <input
              type="url"
              value={musicUrl}
              onChange={(event) => {
                setMusicUrl(event.target.value);
                if (event.target.value.trim() !== lookedUp) {
                  setMusicEmbed(null);
                  setMusicError(false);
                }
              }}
              onBlur={(event) => lookUpMusic(event.currentTarget.value)}
              placeholder="Colle un lien Spotify, Apple Music, Deezer ou YouTube (titre, album ou playlist...)"
              aria-label="Lien de la musique"
              className="db-input"
              style={{ ...field, padding: "10px 14px", fontSize: 12 }}
            />
            <p className="mt-1.5" style={{ fontSize: 10, color: DIM }}>
              🟢 Spotify · 🔴 Apple Music · 🟠 Deezer · 🔴 YouTube
            </p>
            <p className="mt-1" style={{ fontSize: 9, color: DIM, fontStyle: "italic" }}>Titres · Albums · Playlists supportés</p>
            {musicLoading && <p className="mt-2" style={{ fontSize: 11, color: DIM }}>Recherche du morceau…</p>}
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
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder={type === "musique" ? "Dis-nous pourquoi tu partages ça..." : "Ajouter un commentaire..."}
          aria-label="Commentaire"
          rows={4}
          autoFocus
          className="db-input mt-3 block resize-none"
          style={{ ...field, padding: "12px 14px", fontSize: 13, lineHeight: 1.5 }}
        />

        <p className="mb-2 mt-3" style={{ fontSize: 11, color: DIM }}>Catégorie</p>
        <div className="flex flex-wrap" style={{ gap: 6 }}>
          {categories.map((item) => {
            const isActive = category === item.label;
            return (
              <button
                key={item.label}
                type="button"
                aria-pressed={isActive}
                onClick={() => setCategory(isActive ? null : item.label)}
                className={isActive ? "" : "db-chip"}
                style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, ...(isActive ? tones[item.tone] : {}) }}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        {error && (
          <p role="alert" className="mt-3" style={{ fontSize: 12, color: "#C0392B" }}>
            {error}
          </p>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <p style={{ fontSize: 11, color: DIM }}>Visible par tes abonnés</p>
          <button
            type="submit"
            disabled={(type === "musique" ? !musicEmbed : content.trim() === "") || submitting}
            className="db-fab disabled:cursor-not-allowed disabled:opacity-50"
            style={{ color: CREAM, fontSize: 13, fontWeight: 500, padding: "10px 24px", borderRadius: 20 }}
          >
            {submitting ? "Publication…" : "Publier"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Newsletter article card (shown in the feed) ──────────────────────

function NewsletterFeedCard({ articles }: { articles: NewsletterArticle[] }) {
  if (articles.length === 0) return null;
  return (
    <div style={{ ...card, padding: 0, overflow: "hidden" }}>
      <div className="flex items-center gap-2" style={{ padding: "14px 16px 10px", borderBottom: `1px solid ${black(0.05)}` }}>
        <span style={{ fontSize: 16 }}>📬</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>Tes newsletters</span>
        <Link href="/newsletter" className="ml-auto db-hover" style={{ fontSize: 11, color: INDIGO, fontWeight: 500, padding: "2px 8px", borderRadius: 6 }}>
          Gérer →
        </Link>
      </div>
      <div className="flex flex-col" style={{ gap: 0 }}>
        {articles.map((a, i) => (
          <a
            key={`${a.source_id}-${i}`}
            href={a.url}
            target="_blank"
            rel="noopener noreferrer"
            className="db-hover flex gap-3"
            style={{
              padding: "12px 16px",
              textDecoration: "none",
              borderBottom: i < articles.length - 1 ? `1px solid ${black(0.04)}` : undefined,
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: a.source_color,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {a.source_icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: TEXT, lineHeight: 1.3 }}>
                {a.title}
              </p>
              {a.description && (
                <p className="line-clamp-2" style={{ fontSize: 11, color: ink(0.5), lineHeight: 1.4, marginTop: 2 }}>
                  {a.description}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span style={{ fontSize: 10, color: ink(0.4) }}>{a.source_name}</span>
                <span style={{ fontSize: 10, color: ink(0.3) }}>·</span>
                <span style={{ fontSize: 10, color: ink(0.4) }}>{a.theme}</span>
              </div>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const router = useRouter();
  // undefined while the session is still being read, null once known to be absent.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [filter, setFilter] = useState("Tout");
  const [modalOpen, setModalOpen] = useState(false);
  // null while the feed is loading.
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  // The reader's own likes, reactions and comments on the loaded posts.
  const [mine, setMine] = useState<Record<string, MyInteractions>>({});
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  // Phones: the left sidebar opens as a drawer from the hamburger button.
  const [sidebarOpen, setSidebarOpen] = useState(false);
  // Phones: the right sidebar opens as a bottom sheet from the utility button.
  const [utilityOpen, setUtilityOpen] = useState(false);
  // Users the viewer follows, shown in the left sidebar.
  const [following, setFollowing] = useState<PublicProfile[]>([]);
  // Newsletter articles from subscribed RSS feeds.
  const [nlArticles, setNlArticles] = useState<NewsletterArticle[]>([]);
  // Podcast subscription count for the sidebar.
  const [podcastSubCount, setPodcastSubCount] = useState(0);

  useEffect(() => {
    if (!sidebarOpen && !utilityOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { setSidebarOpen(false); setUtilityOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen, utilityOpen]);

  // The local copy shows instantly; the one saved on the profile wins once read.
  useEffect(() => {
    const local = readLocalPreferences();
    if (local) setPreferences(local);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const user = session?.user;
  const userId = user?.id;

  const loadPosts = useCallback(async () => {
    setFeedError(null);
    const { data, error } = await supabase
      .from("posts")
      .select(POST_SELECT)
      // Leftovers from testing the Apple Shortcut, filtered in the query so the 20 posts are real ones.
      .not("content", "ilike", "%Morceau actuel%")
      .not("content", "ilike", "%Test du Raccourci%")
      .order("created_at", { ascending: false })
      .limit(20);

    if (error) {
      setFeedError(error.message);
      return;
    }

    // Loaded before the posts are shown, so each card starts in the right state.
    const loaded = data as Post[];
    const { data: auth } = await supabase.auth.getSession();
    const viewerId = auth.session?.user.id;
    const byPost: Record<string, MyInteractions> = {};
    if (viewerId && loaded.length > 0) {
      const { data: rows } = await supabase
        .from("interactions")
        .select("post_id, type, content")
        .eq("user_id", viewerId)
        .in("post_id", loaded.map((post) => post.id));
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
      // Accounts created before their email was confirmed have no profile yet.
      const error = user ? await ensureProfile(user) : null;
      if (cancelled) return;
      setProfileError(error);

      const { data } = await supabase
        .from("profiles")
        .select("name, username, location")
        .eq("id", userId)
        .maybeSingle();
      if (!cancelled) setProfile(data);

      const remote = await readRemotePreferences(userId);
      if (!cancelled && remote) setPreferences(remote);
    })();
    return () => {
      cancelled = true;
    };
    // Keyed on the user id: the user object changes identity on token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loadPosts]);

  // Load the list of users the viewer follows for the sidebar.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getFollowing(userId).then((list) => { if (!cancelled) setFollowing(list); });
    return () => { cancelled = true; };
  }, [userId]);

  // Load newsletter articles from subscribed sources' RSS feeds.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const subs = await getUserSubscriptions(userId);
      if (cancelled || subs.length === 0) return;
      const sourceIds = subs.map((s) => s.source_id);
      // Only fetch sources that have an RSS feed
      const withFeed = NEWSLETTER_SOURCES.filter((s) => sourceIds.includes(s.id) && s.feed_url);
      if (withFeed.length === 0) return;
      try {
        const res = await fetch(`/api/newsletters?sources=${withFeed.map((s) => s.id).join(",")}`);
        if (!res.ok) return;
        const { articles } = await res.json();
        if (!cancelled) setNlArticles(articles ?? []);
      } catch { /* silently skip */ }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Load podcast subscription count for sidebar.
  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    getUserPodcastSubscriptions(userId).then((list) => { if (!cancelled) setPodcastSubCount(list.length); });
    return () => { cancelled = true; };
  }, [userId]);

  const closeModal = useCallback(() => setModalOpen(false), []);

  // Recommended articles: a search on the chosen themes, or the general feed without any.
  const query = themesQuery(preferences.themes);
  const news = useNews(query ? { q: query } : { category: "Actualités" }, preferences.modules.actualites && Boolean(userId));

  const handleSavePreferences = async (next: Preferences) => {
    setPreferences(next);
    const savedOnline = userId ? await savePreferences(userId, next) : false;
    return savedOnline
      ? "Préférences enregistrées."
      : "Enregistrées sur cet appareil seulement : la sauvegarde sur ton profil a échoué.";
  };

  // Nothing is shown until the session is confirmed, so a signed-out visitor
  // never sees the dashboard before being redirected.
  if (!session) {
    return <div className="min-h-screen" style={{ background: CREAM }} />;
  }

  const email = session.user.email;
  const displayName = profile?.name ?? email?.split("@")[0] ?? "";
  const username = profile?.username ?? email?.split("@")[0] ?? "";
  const initials = getInitials(profile?.name ?? null, email);

  type FeedItem = { key: string; tags: string[]; node: ReactNode };
  const on = (moduleId: ModuleId) => preferences.modules[moduleId];
  const typeModule: Partial<Record<PostType, ModuleId>> = { article: "actualites", musique: "musique", livre: "livres" };

  // 1. Posts from Supabase (reflections are always shown, other types follow their module).
  const postItems: FeedItem[] = (posts ?? [])
    .filter((post) => {
      const moduleId = typeModule[post.type];
      return !moduleId || on(moduleId);
    })
    .map((post) => ({ key: post.id, tags: postTags(post), node: <PostCard post={post} /> }));
  if (postItems.length === 0) {
    postItems.push({ key: "welcome", tags: [], node: <WelcomeCard onNewPost={() => setModalOpen(true)} /> });
  }

  // 2. Social + news items, assembled then sorted by the user's moduleOrder.
  const moduleItems: Record<string, FeedItem[]> = {};

  if (on("musique")) (moduleItems["musique"] ??= []).push({ key: "listening", tags: ["Musique"], node: <NowListeningCard /> });
  if (on("livres")) (moduleItems["livres"] ??= []).push({ key: "reading", tags: ["Livres"], node: <ReadingNowCard /> });
  if (on("reactions")) (moduleItems["reactions"] ??= []).push({ key: "discussions", tags: [], node: <DiscussionsCard /> });
  if (on("marches")) (moduleItems["marches"] ??= []).push({ key: "markets", tags: ["Actualités"], node: <MarketsFlashCard /> });
  if (on("actualites")) {
    const items: FeedItem[] = [];
    if (news.error) {
      items.push({ key: "news-error", tags: ["Actualités"], node: <NewsError onRetry={news.retry} /> });
    } else if (news.loading || !news.articles) {
      items.push({ key: "news-loading", tags: ["Actualités"], node: <NewsSkeleton /> });
    } else {
      for (const article of news.articles.slice(0, NEWS_IN_FEED)) {
        items.push({
          key: article.url,
          tags: ["Actualités"],
          node: <NewsCard article={article} user={session.user} onShared={loadPosts} />,
        });
      }
    }
    moduleItems["actualites"] = items;
  }

  // 2b. Newsletter articles from subscribed RSS feeds
  if (nlArticles.length > 0) {
    (moduleItems["actualites"] ??= []).push({
      key: "newsletter-feed",
      tags: ["Actualités"],
      node: <NewsletterFeedCard articles={nlArticles.slice(0, 5)} />,
    });
  }

  // Sort module items by user's moduleOrder preference.
  const sortedModuleItems: FeedItem[] = preferences.moduleOrder
    .flatMap((id) => moduleItems[id] ?? []);

  // 3. Recommendations (fed by the news API; the static placeholder has been removed).
  const discoveryItems: FeedItem[] = [];

  const interleave = (first: FeedItem[], second: FeedItem[]) =>
    Array.from({ length: Math.max(first.length, second.length) }, (_, index) => [first[index], second[index]])
      .flat()
      .filter((item): item is FeedItem => Boolean(item));

  const feedItems =
    preferences.order === "social"
      ? [...postItems, ...sortedModuleItems, ...discoveryItems]
      : preferences.order === "actualites"
        ? [...sortedModuleItems, ...postItems, ...discoveryItems]
        : [...interleave(postItems, sortedModuleItems), ...discoveryItems];
  const isVisible = (tags: string[]) => filter === "Tout" || tags.includes(filter);
  const hasVisibleItem = feedItems.some((item) => isVisible(item.tags));

  return (
    <SocialContext.Provider value={{ user: session.user, viewerName: profile?.name ?? null, mine }}>
    <div className="flex h-screen flex-col" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <style>{css}</style>
      <Navbar />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[220px_1fr_260px]">
        {sidebarOpen && (
          <div aria-hidden className="fixed inset-0 z-40 md:hidden" style={{ background: "rgba(28,26,21,0.35)" }} onClick={() => setSidebarOpen(false)} />
        )}
        {/* Left sidebar: a drawer on phones */}
        <aside
          id="db-sidebar"
          className={`${sidebarOpen ? "fixed inset-y-0 left-0 z-50 block w-[280px] max-w-[85vw] shadow-xl" : "hidden"} overflow-y-auto md:static md:z-auto md:block md:w-auto md:max-w-none md:shadow-none`}
          style={{ background: WHITE, borderRight: `1px solid ${black(0.07)}`, padding: "20px 16px" }}
          // Following a link or picking a filter closes the drawer.
          onClick={(event) => {
            if ((event.target as HTMLElement).closest("a, button")) setSidebarOpen(false);
          }}
        >
          <button type="button" aria-label="Fermer le menu" className="db-hover mb-3 ml-auto flex md:hidden" style={{ borderRadius: 8, padding: "2px 8px", fontSize: 18, color: ink(0.5) }}>
            ✕
          </button>
          <div className="flex items-center gap-2.5">
            <Avatar initials={initials} size={40} background={INDIGO} color={CREAM} />
            <div className="min-w-0">
              <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{displayName}</p>
              <p className="truncate" style={{ fontSize: 11, color: DIM }}>
                @{username}
                {profile?.location && ` · ${profile.location}`}
              </p>
            </div>
          </div>
          <Link
            href="/profile"
            className="db-hover mt-2 block w-full text-center"
            style={{ border: `1px solid ${black(0.1)}`, borderRadius: 8, fontSize: 11, padding: "5px 10px", color: ink(0.5) }}
          >
            Voir mon profil
          </Link>

          <Divider />

          <nav className="flex flex-col" style={{ gap: 2 }}>
            {navItems.map((item) => {
              const isActive = item.filter === filter;
              const style: CSSProperties = {
                padding: "8px 12px",
                borderRadius: 10,
                fontSize: 13,
                gap: 10,
                color: isActive ? TEXT : ink(0.5),
                fontWeight: isActive ? 500 : 400,
                ...(isActive ? { background: SURFACE } : {}),
              };
              const className = `flex items-center text-left ${isActive ? "" : "db-hover"}`;
              const content = (
                <>
                  <span aria-hidden>{item.icon}</span>
                  {item.label}
                </>
              );
              return item.href ? (
                <Link key={item.label} href={item.href} className={className} style={style}>
                  {content}
                </Link>
              ) : (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => item.filter && setFilter(item.filter)}
                  aria-current={isActive ? "page" : undefined}
                  className={className}
                  style={style}
                >
                  {content}
                </button>
              );
            })}
          </nav>

          <Divider />

          <SectionLabel>Abonnements</SectionLabel>
          {following.length > 0 ? (
            <div className="flex flex-col" style={{ gap: 6 }}>
              {following.slice(0, 6).map((user) => {
                const t = avatarTones[(user.id.charCodeAt(0) + user.id.charCodeAt(1)) % avatarTones.length];
                return (
                  <Link key={user.id} href={`/profile?id=${user.id}`} className="db-hover flex items-center" style={{ gap: 8, padding: "4px 8px", borderRadius: 8 }}>
                    <Avatar initials={getInitials(user.name, user.username)} size={26} {...t} />
                    <span className="min-w-0 truncate" style={{ fontSize: 12, color: TEXT }}>{user.name ?? user.username}</span>
                  </Link>
                );
              })}
              {following.length > 6 && (
                <Link href="/explore" style={{ fontSize: 11, color: INDIGO, padding: "2px 8px" }}>
                  Voir tous ({following.length}) →
                </Link>
              )}
            </div>
          ) : (
            <p style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>
              <Link href="/explore" style={{ color: INDIGO }}>Découvre des profils</Link> à suivre.
            </p>
          )}

          <Divider />

          <SectionLabel>Qui est en ligne</SectionLabel>
          <p style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>
            {following.length > 0 ? "Aucun abonné en ligne pour le moment." : "Suis des profils pour voir leur activité ici."}
          </p>

          <Divider />

          <SectionLabel>Mes espaces</SectionLabel>
          <div className="grid grid-cols-2" style={{ gap: 6 }}>
            {spaces.map((space) => {
              const content = (
                <>
                  <span aria-hidden style={{ fontSize: 16 }}>{space.icon}</span>
                  <span className="mt-1 block" style={{ fontSize: 11, fontWeight: 500, color: TEXT }}>{space.title}</span>
                  <span className="block" style={{ fontSize: 10, color: DIM }}>{space.detail}</span>
                </>
              );
              const style: CSSProperties = { borderRadius: 10, padding: 10 };
              return space.href ? (
                <Link key={space.title} href={space.href} className="db-space block" style={style}>
                  {content}
                </Link>
              ) : (
                <button
                  key={space.title}
                  type="button"
                  onClick={() => space.filter && setFilter(space.filter)}
                  className="db-space text-left"
                  style={style}
                >
                  {content}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Feed */}
        <div className="relative min-h-0 min-w-0">
          <main className="flex h-full flex-col overflow-y-auto px-3 md:px-5" style={{ background: CREAM, paddingBottom: 96, gap: 12 }}>
            <div className="sticky top-0 z-10 mb-2 shrink-0" style={{ background: CREAM, paddingTop: 20, paddingBottom: 12, borderBottom: `1px solid ${black(0.06)}` }}>
              <div className="db-noscrollbar flex overflow-x-auto" style={{ gap: 6 }}>
                <button
                  type="button"
                  onClick={() => setSidebarOpen(true)}
                  aria-label="Ouvrir le menu"
                  aria-expanded={sidebarOpen}
                  aria-controls="db-sidebar"
                  className="db-hover flex shrink-0 items-center md:hidden"
                  style={{ border: `1px solid ${black(0.1)}`, borderRadius: 20, padding: "3px 12px", fontSize: 16, color: ink(0.6) }}
                >
                  ☰
                </button>
                {filters.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setFilter(item)}
                    aria-pressed={filter === item}
                    className={`shrink-0 ${filter === item ? "" : "db-pill"}`}
                    style={{
                      fontSize: 12,
                      padding: "5px 14px",
                      borderRadius: 20,
                      ...(filter === item ? { background: INDIGO, color: CREAM } : {}),
                    }}
                  >
                    {item}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => setCustomizerOpen(true)}
                  className="db-hover ml-auto flex shrink-0 items-center"
                  style={{ gap: 5, border: `1px solid ${black(0.1)}`, borderRadius: 20, padding: "5px 14px", fontSize: 12, color: ink(0.5) }}
                >
                  <span aria-hidden>⚙️</span> Personnaliser
                </button>
              </div>
            </div>

            {profileError && (
              <p role="alert" style={{ ...card, fontSize: 12, color: "#C0392B" }}>
                Ton profil n&apos;a pas pu être créé : {profileError}
              </p>
            )}

            {feedError ? (
              <div role="alert" className="text-center" style={{ ...card, padding: "40px 20px" }}>
                <p style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>Impossible de charger le feed</p>
                <p className="mt-1.5" style={{ fontSize: 12, color: "#C0392B" }}>{feedError}</p>
                <button
                  type="button"
                  onClick={loadPosts}
                  className="db-hover mt-4"
                  style={{ border: `1px solid ${black(0.1)}`, borderRadius: 8, fontSize: 12, padding: "6px 16px", color: ink(0.6) }}
                >
                  Réessayer
                </button>
              </div>
            ) : posts === null ? (
              <>
                <span className="sr-only" role="status">Chargement du feed…</span>
                <SkeletonCard />
                <SkeletonCard />
                <SkeletonCard />
              </>
            ) : (
              <>
                {/* Hidden rather than unmounted, so likes and drafts survive a filter change. */}
                {feedItems.map((item) => (
                  <div key={item.key} hidden={!isVisible(item.tags)} className="shrink-0">
                    {item.node}
                  </div>
                ))}
                {!hasVisibleItem && (
                  <p className="text-center" style={{ border: `1px dashed ${black(0.12)}`, borderRadius: 14, padding: "40px 20px", fontSize: 13, color: DIM }}>
                    {feedItems.length === 0
                      ? "Tous les modules sont désactivés : réactive-en depuis « Personnaliser »."
                      : `Rien dans « ${filter} » pour l'instant.`}
                  </p>
                )}
              </>
            )}
          </main>

          {/* Mobile: utility button (left of FAB) */}
          <button
            type="button"
            onClick={() => setUtilityOpen(true)}
            aria-label="Ouvrir le panneau utilitaire"
            className="db-hover absolute bottom-6 right-[72px] z-20 flex items-center justify-center md:hidden"
            style={{ background: WHITE, width: 40, height: 40, borderRadius: "50%", fontSize: 16, border: `1px solid ${black(0.1)}`, boxShadow: "0 2px 12px rgba(0,0,0,0.08)" }}
          >
            ⚡
          </button>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            aria-label="Nouveau post"
            title="Nouveau post"
            className="db-fab absolute bottom-6 right-6 z-20 flex items-center justify-center"
            style={{ color: CREAM, width: 48, height: 48, borderRadius: "50%", fontSize: 22, boxShadow: "0 4px 20px rgba(42,53,96,0.3)" }}
          >
            +
          </button>
        </div>

        {/* Right sidebar — utility panel */}
        <aside className="hidden overflow-y-auto md:block" style={{ background: WHITE, borderLeft: `1px solid ${black(0.07)}`, padding: "20px 16px" }}>
          {/* Quick stats */}
          <SectionLabel>Mon activité</SectionLabel>
          <div className="grid grid-cols-2" style={{ gap: 6 }}>
            {[
              { icon: "✏️", value: String(posts?.length ?? 0), label: "posts" },
              { icon: "🎵", value: String((posts ?? []).filter((p) => p.type === "musique").length), label: "musiques" },
              { icon: "📖", value: String((posts ?? []).filter((p) => p.type === "livre").length), label: "livres" },
              { icon: "💬", value: String((posts ?? []).filter((p) => p.type === "reflexion").length), label: "réflexions" },
            ].map((stat) => (
              <div key={stat.label} className="text-center" style={{ background: CREAM, borderRadius: 10, padding: "10px 8px" }}>
                <p style={{ fontSize: 14 }} aria-hidden>{stat.icon}</p>
                <p style={{ fontSize: 16, fontWeight: 600, color: TEXT, lineHeight: 1.2 }}>{stat.value}</p>
                <p style={{ fontSize: 10, color: DIM }}>{stat.label}</p>
              </div>
            ))}
          </div>

          <Divider />

          {/* Quick actions */}
          <SectionLabel>Raccourcis</SectionLabel>
          <div className="flex flex-col" style={{ gap: 4 }}>
            {[
              { icon: "➕", label: "Nouveau post", action: () => setModalOpen(true) },
              { icon: "⚙️", label: "Personnaliser le feed", action: () => setCustomizerOpen(true) },
            ].map((shortcut) => (
              <button
                key={shortcut.label}
                type="button"
                onClick={shortcut.action}
                className="db-hover flex items-center text-left"
                style={{ padding: "8px 10px", borderRadius: 10, fontSize: 12, gap: 8, color: ink(0.6) }}
              >
                <span aria-hidden style={{ fontSize: 14 }}>{shortcut.icon}</span>
                {shortcut.label}
              </button>
            ))}
            <Link
              href="/livres"
              className="db-hover flex items-center"
              style={{ padding: "8px 10px", borderRadius: 10, fontSize: 12, gap: 8, color: ink(0.6) }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>📖</span>
              Mes livres
            </Link>
            <Link
              href="/newsletter"
              className="db-hover flex items-center"
              style={{ padding: "8px 10px", borderRadius: 10, fontSize: 12, gap: 8, color: ink(0.6) }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>📬</span>
              Newsletters
            </Link>
            <Link
              href="/podcasts"
              className="db-hover flex items-center"
              style={{ padding: "8px 10px", borderRadius: 10, fontSize: 12, gap: 8, color: ink(0.6) }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>🎙</span>
              Podcasts{podcastSubCount > 0 ? ` (${podcastSubCount})` : ""}
            </Link>
            <Link
              href="/explore"
              className="db-hover flex items-center"
              style={{ padding: "8px 10px", borderRadius: 10, fontSize: 12, gap: 8, color: ink(0.6) }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>🧭</span>
              Explorer des profils
            </Link>
            <Link
              href="/profile"
              className="db-hover flex items-center"
              style={{ padding: "8px 10px", borderRadius: 10, fontSize: 12, gap: 8, color: ink(0.6) }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>👤</span>
              Mon profil
            </Link>
            <Link
              href="/settings"
              className="db-hover flex items-center"
              style={{ padding: "8px 10px", borderRadius: 10, fontSize: 12, gap: 8, color: ink(0.6) }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>🔧</span>
              Paramètres
            </Link>
            <Link
              href="/actualites"
              className="db-hover flex items-center"
              style={{ padding: "8px 10px", borderRadius: 10, fontSize: 12, gap: 8, color: ink(0.6) }}
            >
              <span aria-hidden style={{ fontSize: 14 }}>📰</span>
              Toutes les actualités
            </Link>
          </div>

          <Divider />

          {/* Themes — visual indicator of active interests */}
          <SectionLabel>Mes thèmes actifs</SectionLabel>
          <div className="flex flex-wrap" style={{ gap: 5 }}>
            {(preferences.themes.length > 0 ? preferences.themes : ["Aucun thème sélectionné"]).map((theme) => (
              <span
                key={theme}
                style={{
                  background: preferences.themes.length > 0 ? "rgba(42,53,96,0.07)" : "transparent",
                  color: preferences.themes.length > 0 ? INDIGO : DIM,
                  fontSize: 11,
                  borderRadius: 20,
                  padding: "4px 12px",
                }}
              >
                {theme}
              </span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setCustomizerOpen(true)}
            className="db-hover mt-2 w-full"
            style={{ border: `1px solid ${black(0.08)}`, borderRadius: 8, fontSize: 11, padding: 6, color: ink(0.6) }}
          >
            Modifier mes thèmes
          </button>

          <Divider />

          {/* Newsletter */}
          <SectionLabel>Ta newsletter</SectionLabel>
          <Link href="/newsletter" style={{ textDecoration: "none" }}>
            <div className="db-hover" style={{ background: CREAM, borderRadius: 12, padding: 12, cursor: "pointer" }}>
              <p className="mb-1" style={{ fontSize: 11, fontWeight: 500, color: TEXT }}>📬 Curio Daily</p>
              <p className="mb-2" style={{ fontSize: 11, color: DIM }}>Découvre et abonne-toi à des newsletters culturelles françaises.</p>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11, color: INDIGO, fontWeight: 500 }}>Gérer mes abonnements →</span>
              </div>
            </div>
          </Link>

          <Divider />

          {/* Podcasts */}
          <SectionLabel>Tes podcasts</SectionLabel>
          <Link href="/podcasts" style={{ textDecoration: "none" }}>
            <div className="db-hover" style={{ background: CREAM, borderRadius: 12, padding: 12, cursor: "pointer" }}>
              <p className="mb-1" style={{ fontSize: 11, fontWeight: 500, color: TEXT }}>🎙 Podcasts culturels</p>
              <p className="mb-2" style={{ fontSize: 11, color: DIM }}>
                {podcastSubCount > 0
                  ? `${podcastSubCount} podcast${podcastSubCount > 1 ? "s" : ""} suivi${podcastSubCount > 1 ? "s" : ""}`
                  : "Découvre les meilleurs podcasts culturels français."}
              </p>
              <div className="flex items-center justify-between">
                <span style={{ fontSize: 11, color: INDIGO, fontWeight: 500 }}>Gérer mes podcasts →</span>
              </div>
            </div>
          </Link>
        </aside>
      </div>

      {modalOpen && (
        <NewPostModal
          user={session.user}
          onClose={closeModal}
          onCreated={() => {
            setModalOpen(false);
            loadPosts();
          }}
        />
      )}
      {customizerOpen && (
        <Customizer initial={preferences} onClose={() => setCustomizerOpen(false)} onSave={handleSavePreferences} />
      )}

      {/* Mobile utility bottom sheet */}
      {utilityOpen && (
        <>
          <div
            aria-hidden
            className="fixed inset-0 z-40 md:hidden"
            style={{ background: "rgba(28,26,21,0.35)" }}
            onClick={() => setUtilityOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Panneau utilitaire"
            className="fixed inset-x-0 bottom-0 z-50 md:hidden"
            style={{ background: WHITE, borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: "75vh", overflowY: "auto", boxShadow: "0 -8px 40px rgba(0,0,0,0.12)" }}
          >
            <div className="flex items-center justify-between" style={{ padding: "16px 20px 8px", borderBottom: `1px solid ${black(0.06)}` }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>⚡ Utilitaires</span>
              <button type="button" onClick={() => setUtilityOpen(false)} aria-label="Fermer" className="db-play" style={{ fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: "12px 20px 24px" }}>
              {/* Stats grid */}
              <div className="grid grid-cols-4" style={{ gap: 8, marginBottom: 16 }}>
                {[
                  { icon: "✏️", value: String(posts?.length ?? 0), label: "posts" },
                  { icon: "🎵", value: String((posts ?? []).filter((p) => p.type === "musique").length), label: "musiques" },
                  { icon: "📖", value: String((posts ?? []).filter((p) => p.type === "livre").length), label: "livres" },
                  { icon: "💬", value: String((posts ?? []).filter((p) => p.type === "reflexion").length), label: "réflexions" },
                ].map((stat) => (
                  <div key={stat.label} className="text-center" style={{ background: CREAM, borderRadius: 10, padding: "10px 4px" }}>
                    <p style={{ fontSize: 14 }} aria-hidden>{stat.icon}</p>
                    <p style={{ fontSize: 16, fontWeight: 600, color: TEXT, lineHeight: 1.2 }}>{stat.value}</p>
                    <p style={{ fontSize: 9, color: DIM }}>{stat.label}</p>
                  </div>
                ))}
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2" style={{ gap: 8 }}>
                {[
                  { icon: "➕", label: "Nouveau post", action: () => { setUtilityOpen(false); setModalOpen(true); } },
                  { icon: "⚙️", label: "Personnaliser", action: () => { setUtilityOpen(false); setCustomizerOpen(true); } },
                ].map((shortcut) => (
                  <button
                    key={shortcut.label}
                    type="button"
                    onClick={shortcut.action}
                    className="db-hover flex items-center justify-center"
                    style={{ background: CREAM, padding: "12px 10px", borderRadius: 12, fontSize: 12, gap: 6, color: ink(0.6) }}
                  >
                    <span aria-hidden>{shortcut.icon}</span>
                    {shortcut.label}
                  </button>
                ))}
              </div>
              <div className="mt-2 grid grid-cols-3" style={{ gap: 8 }}>
                {[
                  { icon: "🧭", label: "Explorer", href: "/explore" },
                  { icon: "👤", label: "Profil", href: "/profile" },
                  { icon: "🔧", label: "Paramètres", href: "/settings" },
                ].map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    onClick={() => setUtilityOpen(false)}
                    className="db-hover flex flex-col items-center"
                    style={{ background: CREAM, padding: "12px 8px", borderRadius: 12, fontSize: 11, gap: 4, color: ink(0.6) }}
                  >
                    <span aria-hidden style={{ fontSize: 16 }}>{link.icon}</span>
                    {link.label}
                  </Link>
                ))}
              </div>

              {/* Active themes */}
              {preferences.themes.length > 0 && (
                <div className="mt-4">
                  <p style={{ fontSize: 9, color: ink(0.35), letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 400, marginBottom: 8 }}>Mes thèmes</p>
                  <div className="flex flex-wrap" style={{ gap: 5 }}>
                    {preferences.themes.map((theme) => (
                      <span key={theme} style={{ background: "rgba(42,53,96,0.07)", color: INDIGO, fontSize: 11, borderRadius: 20, padding: "4px 12px" }}>{theme}</span>
                    ))}
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

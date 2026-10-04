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
import { avatarTones, contacts, onlineNow, recentActivity, trends } from "@/lib/sample-data";
import { supabase } from "@/lib/supabase";

const CREAM = "#F7F4EE";
const SURFACE = "#F0EBE1";
const INDIGO = "#2A3560";
const GOLD = "#C4A94A";
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
  { icon: "🧭", label: "Explorer" },
  { icon: "🎵", label: "Musique", filter: "Musique" },
  { icon: "📖", label: "Livres", filter: "Livres" },
  { icon: "✉️", label: "Newsletter" },
];

const spaces: { icon: string; title: string; detail: string; filter?: string; href?: string }[] = [
  { icon: "🎵", title: "Musique", detail: "4 titres", filter: "Musique" },
  { icon: "📖", title: "Livres", detail: "3 en cours", filter: "Livres" },
  { icon: "🎙", title: "Podcasts", detail: "2 favoris", filter: "Podcasts" },
];

const suggestions = [
  { initials: "NL", name: "Nicolas L.", tags: "Histoire · Philo · Lit.", ...avatarTones[5] },
  { initials: "AV", name: "Amira V.", tags: "Science · Tech · Podcast", ...avatarTones[0] },
  { initials: "PG", name: "Paul G.", tags: "Géopo · Art · Cinéma", ...avatarTones[2] },
];

const newsletterTags = ["Taïwan", "Stoïcisme", "Floating Points", "Sapiens"];

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

function ActionButton({
  children,
  active = false,
  activeStyle,
  onClick,
  className = "",
  label,
}: {
  children: ReactNode;
  active?: boolean;
  activeStyle?: CSSProperties;
  onClick: () => void;
  className?: string;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={`flex items-center ${active ? "" : "db-action"} ${className}`}
      style={{
        padding: "5px 10px",
        borderRadius: 8,
        fontSize: 12,
        gap: 5,
        color: ink(0.55),
        ...(active ? (activeStyle ?? { color: INDIGO, background: "rgba(42,53,96,0.07)" }) : {}),
      }}
    >
      {children}
    </button>
  );
}

const sampleComments = [
  {
    initials: "MK",
    name: "Marc K.",
    text: "Le parallèle avec 1996 est frappant — même si les rapports de force ont radicalement changé.",
    ...avatarTones[1],
  },
];

function ArticleCard() {
  return (
    <article className="db-card" style={card}>
      <CardHeader
        avatar={<Avatar initials="SA" size={30} {...avatarTones[0]} />}
        name="Sophie A."
        verb="partage un article"
        pill={<Pill tone="green">Géopolitique</Pill>}
        time="14 min"
      />
      <h3 className="mt-3" style={{ fontSize: 15, fontWeight: 500, color: TEXT, lineHeight: 1.4 }}>
        Détroit de Taïwan : derrière la manœuvre navale, une nouvelle grammaire de la tension
      </h3>
      <p className="mt-2" style={{ fontSize: 12, color: ink(0.55), lineHeight: 1.6 }}>
        La présence renforcée de la 7e flotte américaine relance un débat que Pékin cherche à cadrer à sa façon.
      </p>
      <p className="mt-2 flex items-center" style={{ fontSize: 11, color: ink(0.35), gap: 4 }}>
        <span aria-hidden>↗</span>
        Le Monde · lecture 5 min
      </p>

      <Actions likes={47} comments={11} extra="↗ Partager" save="🔖 Sauvegarder" initialComments={sampleComments} />
    </article>
  );
}

function MusicCard() {
  const [playing, setPlaying] = useState(false);
  const [added, setAdded] = useState(false);

  return (
    <article className="db-card" style={card}>
      <CardHeader
        avatar={<Avatar initials="LR" size={30} {...avatarTones[2]} />}
        name="Léa R."
        verb="écoute"
        pill={<Pill tone="violet">Musique</Pill>}
        time="38 min"
      />
      <div className="mt-3 flex items-center gap-3">
        <span className="flex shrink-0 items-center justify-center" style={{ width: 52, height: 52, background: "#EEEDFE", borderRadius: 10, fontSize: 20, color: "#534AB7" }}>
          🎵
        </span>
        <div className="min-w-0">
          <p className="truncate" style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>Nespole</p>
          <p className="truncate" style={{ fontSize: 12, color: DIM }}>Floating Points · Elaenia</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center" style={{ gap: 12, fontSize: 16, color: ink(0.5) }}>
          <button type="button" aria-label="Morceau précédent">⏮</button>
          <button type="button" onClick={() => setPlaying(!playing)} aria-label={playing ? "Pause" : "Lecture"} style={{ fontSize: 20, color: TEXT }}>
            {playing ? "⏸" : "▶"}
          </button>
          <button type="button" aria-label="Morceau suivant">⏭</button>
        </div>
      </div>
      <div className="mt-3" style={{ height: 3, background: black(0.07), borderRadius: 2 }}>
        <div style={{ height: 3, width: "42%", background: INDIGO, borderRadius: 2 }} />
      </div>
      <div className="mt-1 flex justify-between" style={{ fontSize: 10, color: DIM }}>
        <span>1:58</span>
        <span>3:12</span>
      </div>
      <div className="flex flex-wrap items-end" style={{ gap: 4 }}>
        <Actions likes={23} comments={5} save={null} />
        <ActionButton active={added} onClick={() => setAdded(!added)}>
          {added ? "✓ Dans ma liste" : "+ Ajouter à ma liste"}
        </ActionButton>
      </div>
    </article>
  );
}

function DiscoveryCard() {
  return (
    <article className="db-card" style={card}>
      <div className="flex items-center gap-2">
        <span style={{ fontSize: 10, color: "#534AB7", background: "rgba(83,74,183,0.07)", padding: "3px 10px", borderRadius: 10 }}>
          ✦ Découverte pour toi
        </span>
        <span className="ml-auto">
          <Pill tone="indigo">Philosophie</Pill>
        </span>
      </div>
      <h3 className="mt-3" style={{ fontSize: 15, fontWeight: 500, color: TEXT, lineHeight: 1.4 }}>
        Le stoïcisme comme antidote au monde hyperconnecté
      </h3>
      <p className="mt-1" style={{ fontSize: 12, color: ink(0.45), fontStyle: "italic" }}>
        Parce que tu as lu des articles sur Nietzsche cette semaine, BoredBoard te recommande...
      </p>
      <p className="mt-2" style={{ fontSize: 12, color: ink(0.55), lineHeight: 1.6 }}>
        Comment les Méditations de Marc Aurèle résonnent avec nos crises d&apos;attention modernes.
      </p>
      <p className="mt-2" style={{ fontSize: 11, color: DIM }}>Philosophie Magazine · lecture 8 min</p>
      <Actions likes={134} comments={31} save="🔖 Sauvegarder" />
    </article>
  );
}

function BookCard() {
  const [added, setAdded] = useState(false);

  return (
    <article className="db-card" style={card}>
      <CardHeader
        avatar={<Avatar initials="JD" size={30} {...avatarTones[3]} />}
        name="Jules D."
        verb="lit"
        pill={<Pill tone="olive">Livres</Pill>}
        time="1h"
      />
      <p className="mt-3 pl-3" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontStyle: "italic", fontSize: 13, color: ink(0.6), lineHeight: 1.7, borderLeft: `2px solid ${GOLD}` }}>
        Les grands récits fictifs donnent à l&apos;humanité sa cohésion — c&apos;est peut-être ça, le vrai secret de notre domination.
      </p>
      <div className="mt-3 flex items-center" style={{ background: CREAM, borderRadius: 10, padding: 10, gap: 10 }}>
        <span className="flex shrink-0 items-center justify-center" style={{ width: 30, height: 42, background: "#EEEDFE", borderRadius: 3, fontSize: 12 }}>
          📖
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>Sapiens</p>
          <p className="truncate" style={{ fontSize: 11, color: DIM }}>Yuval Noah Harari</p>
          <div className="mt-1 flex items-center" style={{ gap: 6, fontSize: 10, color: DIM }}>
            <span>p. 214</span>
            <div className="flex-1" style={{ height: 2, maxWidth: 120, background: black(0.07), borderRadius: 2 }}>
              <div style={{ height: 2, width: "48%", background: GOLD, borderRadius: 2 }} />
            </div>
            <span>48%</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setAdded(!added)}
          aria-pressed={added}
          className="db-action ml-auto shrink-0"
          style={{ border: `1px solid ${black(0.1)}`, borderRadius: 8, fontSize: 11, padding: "4px 10px", color: ink(0.6) }}
        >
          {added ? "✓ Ajouté" : "+ Ajouter"}
        </button>
      </div>
      <Actions likes={61} comments={9} />
    </article>
  );
}

function PodcastCard() {
  const [playing, setPlaying] = useState(false);

  return (
    <article className="db-card" style={card}>
      <CardHeader
        avatar={<Avatar initials="NB" size={30} {...avatarTones[4]} />}
        name="Nina B."
        verb="écoute un podcast"
        pill={<Pill tone="rose">Podcast</Pill>}
        time="2h"
      />
      <p className="mt-2" style={{ fontSize: 12, color: ink(0.55), fontStyle: "italic", lineHeight: 1.6 }}>
        Un épisode vertigineux sur la géopolitique de l&apos;eau — la ressource qui va redéfinir les alliances du XXIe siècle.
      </p>
      <div className="mt-3 flex items-center" style={{ background: CREAM, borderRadius: 10, padding: 10, gap: 10 }}>
        <span className="flex shrink-0 items-center justify-center" style={{ width: 40, height: 40, background: "#FAECE7", borderRadius: 8, fontSize: 16 }}>
          🎙
        </span>
        <div className="min-w-0">
          <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>L&apos;eau, nouvelle arme géopolitique</p>
          <p className="truncate" style={{ fontSize: 10, color: DIM }}>Méta de Choc · ep. 52 · 48 min</p>
        </div>
        <button
          type="button"
          onClick={() => setPlaying(!playing)}
          aria-label={playing ? "Pause" : "Lecture"}
          className="db-play ml-auto shrink-0"
          style={{ fontSize: 16, ...(playing ? { color: TEXT } : {}) }}
        >
          {playing ? "⏸" : "▶"}
        </button>
      </div>
      <Actions likes={38} comments={7} />
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
  const embed = usePostEmbed(post);
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
          {post.content && post.content !== embed.title && (
            <p className="mb-3 mt-2 whitespace-pre-wrap break-words" style={{ fontSize: 13, color: ink(0.6), fontStyle: "italic", lineHeight: 1.6 }}>
              {post.content}
            </p>
          )}
          <div className={post.content && post.content !== embed.title ? "" : "mt-3"}>
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

export default function Dashboard() {
  const router = useRouter();
  // undefined while the session is still being read, null once known to be absent.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [filter, setFilter] = useState("Tout");
  const [modalOpen, setModalOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [followed, setFollowed] = useState<string[]>([]);
  // null while the feed is loading.
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  // The reader's own likes, reactions and comments on the loaded posts.
  const [mine, setMine] = useState<Record<string, MyInteractions>>({});
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [customizerOpen, setCustomizerOpen] = useState(false);

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
  if (postItems.length === 0 && on("actualites")) {
    // The sample article only stands in while there is no real post yet.
    postItems.push({ key: "article", tags: ["Actualités"], node: <ArticleCard /> });
  }

  // 2. What the network is doing right now, then the sample shares.
  const socialItems = ([
    on("musique") && { key: "listening", tags: ["Musique"], node: <NowListeningCard /> },
    on("livres") && { key: "reading", tags: ["Livres"], node: <ReadingNowCard /> },
    on("reactions") && { key: "discussions", tags: [], node: <DiscussionsCard /> },
    on("musique") && { key: "music", tags: ["Musique"], node: <MusicCard /> },
    on("livres") && { key: "book", tags: ["Livres"], node: <BookCard /> },
    on("podcasts") && { key: "podcast", tags: ["Podcasts"], node: <PodcastCard /> },
  ] as (FeedItem | false)[]).filter((item): item is FeedItem => Boolean(item));

  // 3. Articles matching the themes, and the markets flash.
  const newsItems: FeedItem[] = [];
  if (on("marches")) newsItems.push({ key: "markets", tags: ["Actualités"], node: <MarketsFlashCard /> });
  if (on("actualites")) {
    if (news.error) {
      newsItems.push({ key: "news-error", tags: ["Actualités"], node: <NewsError onRetry={news.retry} /> });
    } else if (news.loading || !news.articles) {
      newsItems.push({ key: "news-loading", tags: ["Actualités"], node: <NewsSkeleton /> });
    } else {
      for (const article of news.articles.slice(0, NEWS_IN_FEED)) {
        newsItems.push({
          key: article.url,
          tags: ["Actualités"],
          node: <NewsCard article={article} user={session.user} onShared={loadPosts} />,
        });
      }
    }
  }

  // 4. Recommendations.
  const discoveryItems: FeedItem[] = on("decouvertes")
    ? [{ key: "discovery", tags: ["Découvertes", "Philo"], node: <DiscoveryCard /> }]
    : [];

  const interleave = (first: FeedItem[], second: FeedItem[]) =>
    Array.from({ length: Math.max(first.length, second.length) }, (_, index) => [first[index], second[index]])
      .flat()
      .filter((item): item is FeedItem => Boolean(item));

  const feedItems =
    preferences.order === "social"
      ? [...postItems, ...socialItems, ...newsItems, ...discoveryItems]
      : preferences.order === "actualites"
        ? [...newsItems, ...postItems, ...socialItems, ...discoveryItems]
        : [...postItems, ...interleave(socialItems, newsItems), ...discoveryItems];
  const isVisible = (tags: string[]) => filter === "Tout" || tags.includes(filter);
  const hasVisibleItem = feedItems.some((item) => isVisible(item.tags));

  return (
    <SocialContext.Provider value={{ user: session.user, viewerName: profile?.name ?? null, mine }}>
    <div className="flex h-screen flex-col" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <style>{css}</style>
      <Navbar />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[220px_1fr_260px]">
        {/* Left sidebar */}
        <aside className="hidden overflow-y-auto md:block" style={{ background: WHITE, borderRight: `1px solid ${black(0.07)}`, padding: "20px 16px" }}>
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
          <ul className="flex flex-col" style={{ gap: 8 }}>
            {contacts.map((contact) => (
              <li key={contact.initials} className="flex items-center gap-2" style={{ padding: "5px 0" }}>
                <Avatar initials={contact.initials} size={28} background={contact.background} color={contact.color} />
                <div className="min-w-0">
                  <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{contact.name}</p>
                  <p className="truncate" style={{ fontSize: 10, color: DIM }}>{contact.tags}</p>
                </div>
                {contact.online && (
                  <span title="En ligne" className="ml-auto shrink-0" style={{ width: 6, height: 6, background: "#1D9E75", borderRadius: "50%" }} />
                )}
              </li>
            ))}
          </ul>

          <Divider />

          <SectionLabel>Qui est en ligne</SectionLabel>
          <ul className="flex flex-col" style={{ gap: 8 }}>
            {onlineNow.map((person) => (
              <li key={person.initials} className="flex items-center gap-2">
                <span className="relative shrink-0">
                  <Avatar initials={person.initials} size={28} background={person.background} color={person.color} />
                  <span className="absolute" style={{ right: -1, bottom: -1, width: 8, height: 8, background: "#1D9E75", borderRadius: "50%", border: `2px solid ${WHITE}` }} />
                </span>
                <div className="min-w-0">
                  <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{person.name}</p>
                  <p className="truncate" style={{ fontSize: 11, color: DIM }}>{person.activity}</p>
                </div>
              </li>
            ))}
          </ul>

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
          <main className="flex h-full flex-col overflow-y-auto" style={{ background: CREAM, padding: "0 20px 96px", gap: 12 }}>
            <div className="sticky top-0 z-10 mb-2 shrink-0" style={{ background: CREAM, paddingTop: 20, paddingBottom: 12, borderBottom: `1px solid ${black(0.06)}` }}>
              <div className="db-noscrollbar flex overflow-x-auto" style={{ gap: 6 }}>
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

        {/* Right sidebar */}
        <aside className="hidden overflow-y-auto md:block" style={{ background: WHITE, borderLeft: `1px solid ${black(0.07)}`, padding: "20px 16px" }}>
          <SectionLabel>Activité récente</SectionLabel>
          <ul>
            {recentActivity.map((item, index) => (
              <li
                key={item.text}
                className="flex items-start gap-2"
                style={{ padding: "7px 0", borderBottom: index < recentActivity.length - 1 ? `1px solid ${black(0.05)}` : "none" }}
              >
                <span aria-hidden className="shrink-0" style={{ fontSize: 14, lineHeight: 1.2 }}>{item.icon}</span>
                <p className="min-w-0" style={{ fontSize: 11, color: TEXT, lineHeight: 1.4 }}>{item.text}</p>
                <span className="ml-auto shrink-0" style={{ fontSize: 10, color: DIM }}>{item.time}</span>
              </li>
            ))}
          </ul>

          <Divider />

          <SectionLabel>Tendances</SectionLabel>
          <ul>
            {trends.map((trend, index) => (
              <li
                key={trend.topic}
                className="flex items-center justify-between gap-2"
                style={{ padding: "8px 0", borderBottom: index < trends.length - 1 ? `1px solid ${black(0.05)}` : "none" }}
              >
                <span className="truncate" style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{trend.topic}</span>
                <span style={{ fontSize: 11, color: GOLD }}>{trend.count}</span>
              </li>
            ))}
          </ul>


          <Divider />

          <SectionLabel>Découvrir des profils</SectionLabel>
          <ul className="flex flex-col" style={{ gap: 8 }}>
            {suggestions.map((person) => {
              const isFollowed = followed.includes(person.initials);
              return (
                <li key={person.initials} className="flex items-center gap-2" style={{ padding: "6px 0", borderBottom: `1px solid ${black(0.05)}` }}>
                  <Avatar initials={person.initials} size={32} background={person.background} color={person.color} />
                  <div className="min-w-0">
                    <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{person.name}</p>
                    <p className="truncate" style={{ fontSize: 10, color: DIM }}>{person.tags}</p>
                  </div>
                  <button
                    type="button"
                    aria-pressed={isFollowed}
                    onClick={() =>
                      setFollowed(isFollowed ? followed.filter((id) => id !== person.initials) : [...followed, person.initials])
                    }
                    className={`ml-auto shrink-0 ${isFollowed ? "" : "db-hover"}`}
                    style={{
                      border: `1px solid ${black(0.1)}`,
                      borderRadius: 10,
                      fontSize: 10,
                      padding: "3px 10px",
                      ...(isFollowed
                        ? { background: INDIGO, color: CREAM, borderColor: INDIGO }
                        : { color: ink(0.6) }),
                    }}
                  >
                    {isFollowed ? "Suivi" : "Suivre"}
                  </button>
                </li>
              );
            })}
          </ul>

          <Divider />

          <SectionLabel>Ta newsletter · demain</SectionLabel>
          <div style={{ background: CREAM, borderRadius: 12, padding: 12 }}>
            <p className="mb-1" style={{ fontSize: 11, fontWeight: 500, color: TEXT }}>Curio Daily — demain matin</p>
            <p className="mb-2" style={{ fontSize: 11, color: DIM }}>Générée à partir de tes 3 derniers jours.</p>
            <div className="flex flex-wrap" style={{ gap: 4 }}>
              {newsletterTags.map((tag) => (
                <span key={tag} style={{ background: black(0.05), borderRadius: 8, fontSize: 10, padding: "2px 8px", color: ink(0.5) }}>
                  {tag}
                </span>
              ))}
            </div>
            {previewOpen && (
              <p className="mt-2" style={{ fontSize: 11, color: ink(0.6), lineHeight: 1.5 }}>
                Au sommaire : Taïwan et la grammaire de la tension, le stoïcisme
                face à l&apos;hyperconnexion, Floating Points, et où tu en es dans Sapiens.
              </p>
            )}
            <button
              type="button"
              onClick={() => setPreviewOpen(!previewOpen)}
              aria-expanded={previewOpen}
              className="db-hover mt-2 w-full"
              style={{ border: `1px solid ${black(0.08)}`, borderRadius: 8, fontSize: 11, padding: 6, color: ink(0.6) }}
            >
              {previewOpen ? "Masquer" : "Prévisualiser"}
            </button>
          </div>
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
    </div>
    </SocialContext.Provider>
  );
}

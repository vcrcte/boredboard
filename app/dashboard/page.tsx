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
import { ensureProfile } from "@/lib/profile";
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
  profiles: {
    id: string;
    name: string | null;
    username: string;
    avatar_url: string | null;
  } | null;
};

type Profile = { name: string | null; username: string; location: string | null };

const POST_SELECT = "*, profiles (id, name, username, avatar_url)";

const filters = ["Tout", "Actualités", "Musique", "Livres", "Podcasts", "Découvertes", "Philo", "Science", "Art"];

const postTypes: { value: PostType; label: string; verb: string; filter: string }[] = [
  { value: "article", label: "Article", verb: "partage un article", filter: "Actualités" },
  { value: "reflexion", label: "Réflexion", verb: "partage une réflexion", filter: "Découvertes" },
  { value: "livre", label: "Livre", verb: "lit", filter: "Livres" },
  { value: "musique", label: "Musique", verb: "écoute", filter: "Musique" },
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

const avatarTones = [
  { background: "#E1F5EE", color: "#0F6E56" },
  { background: "#FAECE7", color: "#993C1D" },
  { background: "#FAEEDA", color: "#854F0B" },
  { background: "#EAF3DE", color: "#3B6D11" },
  { background: "#FBEAF0", color: "#993556" },
  { background: "#EEEDFE", color: "#534AB7" },
];

// Navigation entries and spaces either filter the feed or link to a page;
// those with neither have no destination yet.
const navItems: { icon: string; label: string; filter?: string; href?: string }[] = [
  { icon: "🏠", label: "Mon espace", filter: "Tout" },
  { icon: "🧭", label: "Explorer" },
  { icon: "🎵", label: "Musique", filter: "Musique" },
  { icon: "📖", label: "Livres", filter: "Livres" },
  { icon: "🎮", label: "Jeux", href: "/jeux/mot-fantome" },
  { icon: "✉️", label: "Newsletter" },
];

const spaces: { icon: string; title: string; detail: string; filter?: string; href?: string }[] = [
  { icon: "🎵", title: "Musique", detail: "4 titres", filter: "Musique" },
  { icon: "📖", title: "Livres", detail: "3 en cours", filter: "Livres" },
  { icon: "🎙", title: "Podcasts", detail: "2 favoris", filter: "Podcasts" },
  { icon: "🎮", title: "Jeux", detail: "Série 7j 🔥", href: "/jeux/mot-fantome" },
];

const contacts = [
  { initials: "SA", name: "Sophie A.", tags: "Géopo · Histoire", online: true, ...avatarTones[0] },
  { initials: "MK", name: "Marc K.", tags: "Philo · Art", online: true, ...avatarTones[1] },
  { initials: "LR", name: "Léa R.", tags: "Musique", online: false, ...avatarTones[2] },
  { initials: "JD", name: "Jules D.", tags: "Livres · Philo", online: false, ...avatarTones[3] },
  { initials: "NB", name: "Nina B.", tags: "Science · Podcast", online: true, ...avatarTones[4] },
];

const notifications = [
  { text: "Sophie a commenté ton partage", time: "8 min", unread: true },
  { text: "43 personnes ont répondu au quiz", time: "22 min", unread: true },
  { text: "Nina te suit maintenant", time: "3h", unread: false },
];

const trends = [
  { topic: "Géopolitique de l'eau", count: "2.4k" },
  { topic: "Stoïcisme & burnout", count: "1.8k" },
  { topic: "James Webb", count: "1.2k" },
  { topic: "Prix Goncourt", count: "876" },
  { topic: "Bauhaus & modernité", count: "541" },
];

const quiz = {
  question: "Quel empire a construit la première route pavée de l'histoire ?",
  options: ["Empire romain", "Empire perse", "Empire assyrien", "Égypte ancienne"],
  // The oldest known paved road is the Lake Moeris quarry road, in Egypt.
  answer: "Égypte ancienne",
  responses: 893,
};

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

function Actions({
  likes,
  comments,
  extra,
  save = "🔖",
}: {
  likes: number;
  comments: number;
  /** Optional third action, e.g. "↗ Partager". */
  extra?: string;
  /** Label of the last action; pass null to leave it out. */
  save?: string | null;
}) {
  const [active, setActive] = useState({ like: false, comment: false, extra: false, save: false });
  const toggle = (key: keyof typeof active) => setActive({ ...active, [key]: !active[key] });

  return (
    <div className="mt-3 flex flex-wrap" style={{ gap: 4 }}>
      <ActionButton
        active={active.like}
        activeStyle={{ color: "#D4537E", background: "rgba(212,83,126,0.06)" }}
        onClick={() => toggle("like")}
        label="Aimer"
      >
        ♥ {likes + (active.like ? 1 : 0)}
      </ActionButton>
      <ActionButton active={active.comment} onClick={() => toggle("comment")} label="Commenter">
        💬 {comments}
      </ActionButton>
      {extra && (
        <ActionButton active={active.extra} onClick={() => toggle("extra")}>
          {extra}
        </ActionButton>
      )}
      {save && (
        <ActionButton active={active.save} onClick={() => toggle("save")} className="ml-auto" label="Sauvegarder">
          {save}
        </ActionButton>
      )}
    </div>
  );
}

function ArticleCard({ viewerInitials }: { viewerInitials: string }) {
  const [comments, setComments] = useState([
    {
      initials: "MK",
      name: "Marc K.",
      text: "Le parallèle avec 1996 est frappant — même si les rapports de force ont radicalement changé.",
      ...avatarTones[1],
    },
  ]);
  const [draft, setDraft] = useState("");

  const handleReply = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.trim()) return;
    setComments([
      ...comments,
      { initials: viewerInitials, name: "Toi", text: draft.trim(), background: INDIGO, color: CREAM },
    ]);
    setDraft("");
  };

  return (
    <article style={card}>
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

      <div className="my-3" style={{ height: 1, background: black(0.06) }} />
      <div className="-mt-3">
        <Actions likes={47} comments={comments.length + 11} extra="↗ Partager" save="🔖 Sauvegarder" />
      </div>

      <ul className="mt-3 flex flex-col gap-2.5" style={{ paddingTop: 10, borderTop: `1px solid ${black(0.05)}` }}>
        {comments.map((comment, index) => (
          <li key={index} className="flex gap-2">
            <Avatar initials={comment.initials} size={22} background={comment.background} color={comment.color} />
            <div className="min-w-0">
              <p style={{ fontSize: 10, fontWeight: 500, color: DIM }}>{comment.name}</p>
              <p className="break-words" style={{ fontSize: 11, color: ink(0.6), lineHeight: 1.5 }}>
                {comment.text}
              </p>
            </div>
          </li>
        ))}
      </ul>

      <form onSubmit={handleReply} className="flex items-center gap-2" style={{ paddingTop: 8 }}>
        <Avatar initials={viewerInitials} size={22} background={INDIGO} color={CREAM} />
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="Répondre..."
          aria-label="Répondre"
          className="db-input min-w-0 flex-1"
          style={{ background: CREAM, border: `1px solid ${black(0.07)}`, borderRadius: 20, padding: "6px 14px", fontSize: 12, color: TEXT, outline: "none" }}
        />
        <button type="submit" aria-label="Envoyer" style={{ color: GOLD, fontSize: 16 }}>
          ➤
        </button>
      </form>
    </article>
  );
}

function MusicCard() {
  const [playing, setPlaying] = useState(false);
  const [added, setAdded] = useState(false);

  return (
    <article style={card}>
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
    <article style={card}>
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
    <article style={card}>
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
    <article style={card}>
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

function PostCard({ post }: { post: Post }) {
  const author = post.profiles;
  const type = postTypes.find((item) => item.value === post.type);
  const category = categories.find((item) => item.label === post.category);
  const link = safeUrl(post.url);
  // A stable colour per author, picked from their id.
  const tone = avatarTones[(post.user_id.charCodeAt(0) + post.user_id.charCodeAt(1)) % avatarTones.length];

  return (
    <article style={card}>
      <CardHeader
        avatar={<Avatar initials={getInitials(author?.name ?? null, author?.username)} size={30} {...tone} />}
        name={author?.name ?? author?.username ?? "Quelqu'un"}
        verb={type?.verb ?? ""}
        pill={post.category ? <Pill tone={category?.tone ?? "indigo"}>{post.category}</Pill> : undefined}
        time={timeAgo(post.created_at)}
      />
      <p className="mt-3 whitespace-pre-wrap break-words" style={{ fontSize: 14, color: TEXT, lineHeight: 1.6 }}>
        {post.content}
      </p>
      {link && (
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
      <Actions likes={post.likes_count ?? 0} comments={0} extra="↗ Partager" />
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

    const trimmedUrl = type === "article" ? url.trim() : "";
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

    const { error: insertError } = await supabase.from("posts").insert({
      user_id: user.id,
      type,
      content: content.trim(),
      url: trimmedUrl || null,
      category,
    });

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
        <textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Ajouter un commentaire..."
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
            disabled={content.trim() === "" || submitting}
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

function Quiz() {
  const [choice, setChoice] = useState<string | null>(null);

  return (
    <div style={{ background: CREAM, borderRadius: 12, padding: 14 }}>
      <span className="mb-2 inline-block" style={{ ...tones.gold, fontSize: 10, borderRadius: 10, padding: "2px 8px" }}>
        Culture générale
      </span>
      <p style={{ fontSize: 12, fontWeight: 500, color: TEXT, lineHeight: 1.5 }}>{quiz.question}</p>
      <div className="mt-3 grid grid-cols-2" style={{ gap: 6 }}>
        {quiz.options.map((option) => {
          const isAnswer = option === quiz.answer;
          const revealed = choice !== null && (isAnswer || option === choice);
          return (
            <button
              key={option}
              type="button"
              disabled={choice !== null}
              onClick={() => setChoice(option)}
              className={revealed ? "" : "db-option"}
              style={{
                border: `1px solid ${black(0.07)}`,
                borderRadius: 8,
                padding: "8px 10px",
                fontSize: 11,
                textAlign: "left",
                ...(revealed
                  ? isAnswer
                    ? { background: "rgba(29,158,117,0.12)", borderColor: "rgba(29,158,117,0.4)", color: "#0F6E56" }
                    : { background: "rgba(192,57,43,0.08)", borderColor: "rgba(192,57,43,0.3)", color: "#C0392B" }
                  : { color: TEXT }),
              }}
            >
              {option}
            </button>
          );
        })}
      </div>
      <p className="mt-2" style={{ fontSize: 10, color: DIM }}>
        {quiz.responses + (choice ? 1 : 0)} réponses aujourd&apos;hui
      </p>
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
    setPosts(data as Post[]);
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
    })();
    return () => {
      cancelled = true;
    };
    // Keyed on the user id: the user object changes identity on token refresh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, loadPosts]);

  const closeModal = useCallback(() => setModalOpen(false), []);

  // Nothing is shown until the session is confirmed, so a signed-out visitor
  // never sees the dashboard before being redirected.
  if (!session) {
    return <div className="min-h-screen" style={{ background: CREAM }} />;
  }

  const email = session.user.email;
  const displayName = profile?.name ?? email?.split("@")[0] ?? "";
  const username = profile?.username ?? email?.split("@")[0] ?? "";
  const initials = getInitials(profile?.name ?? null, email);

  // Real posts come first, always followed by the sample cards. The sample
  // article only stands in while there is no real post yet.
  const realPosts = (posts ?? []).map((post) => ({
    key: post.id,
    tags: postTags(post),
    node: <PostCard post={post} />,
  }));
  const feedItems = [
    ...(realPosts.length > 0
      ? realPosts
      : [{ key: "article", tags: ["Actualités"], node: <ArticleCard viewerInitials={initials} /> }]),
    { key: "discovery", tags: ["Découvertes", "Philo"], node: <DiscoveryCard /> },
    { key: "music", tags: ["Musique"], node: <MusicCard /> },
    { key: "book", tags: ["Livres"], node: <BookCard /> },
    { key: "podcast", tags: ["Podcasts"], node: <PodcastCard /> },
  ];
  const isVisible = (tags: string[]) => filter === "Tout" || tags.includes(filter);
  const hasVisibleItem = feedItems.some((item) => isVisible(item.tags));

  return (
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
            <div className="sticky top-0 z-10 mb-2" style={{ background: CREAM, paddingTop: 20, paddingBottom: 12, borderBottom: `1px solid ${black(0.06)}` }}>
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
                  <div key={item.key} hidden={!isVisible(item.tags)}>
                    {item.node}
                  </div>
                ))}
                {!hasVisibleItem && (
                  <p className="text-center" style={{ border: `1px dashed ${black(0.12)}`, borderRadius: 14, padding: "40px 20px", fontSize: 13, color: DIM }}>
                    Rien dans « {filter} » pour l&apos;instant.
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
          <SectionLabel>Notifications</SectionLabel>
          <ul className="flex flex-col" style={{ gap: 8 }}>
            {notifications.map((notification) => (
              <li
                key={notification.text}
                className="flex items-start gap-2"
                style={{ padding: 8, background: CREAM, borderRadius: 10, opacity: notification.unread ? 1 : 0.5 }}
              >
                <span className="mt-1 shrink-0" style={{ width: 6, height: 6, borderRadius: "50%", background: notification.unread ? INDIGO : "transparent" }} />
                <div>
                  <p style={{ fontSize: 11, color: TEXT, lineHeight: 1.4 }}>{notification.text}</p>
                  <p className="mt-1" style={{ fontSize: 10, color: DIM }}>{notification.time}</p>
                </div>
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

          <SectionLabel>Quiz du jour</SectionLabel>
          <Quiz />

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
    </div>
  );
}

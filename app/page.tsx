"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

// The hero keeps the dark palette; everything after it is on warm cream.
const HERO_BG = "#0A0910";
const HERO_TEXT = "#F0EEE8";
const BG = "#F7F4EE";
const SURFACE = "#F0EBE1";
const SURFACE2 = "#EAE3D6";
const INDIGO = "#3D4F8C";
const GOLD = "#C4A94A";
const TEXT = "#1C1A15";
const HAIRLINE = "rgba(0,0,0,0.07)";
const CARD_BORDER = "rgba(0,0,0,0.08)";

const heroText = (alpha: number) => `rgba(240,238,232,${alpha})`;
const heroWhite = (alpha: number) => `rgba(255,255,255,${alpha})`;
// Dark text needs a little more opacity on cream than light text did on black.
const text = (alpha: number) => `rgba(28,26,21,${Math.round((alpha + 0.05) * 100) / 100})`;
const white = (alpha: number) => `rgba(255,255,255,${alpha})`;
const black = (alpha: number) => `rgba(0,0,0,${alpha})`;
const gold = (alpha: number) => `rgba(196,169,74,${alpha})`;
const indigo = (alpha: number) => `rgba(61,79,140,${alpha})`;

const serif: CSSProperties = { fontFamily: "Georgia, 'Times New Roman', serif", fontWeight: 400 };
const sans: CSSProperties = { fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" };

// Hover, active, focus and keyframe rules can't be expressed as inline styles.
const css = `
body { background: ${BG}; }
html { scroll-behavior: smooth; }
.fade-up { opacity: 0; transform: translateY(24px); transition: opacity 0.65s cubic-bezier(0.16,1,0.3,1), transform 0.65s cubic-bezier(0.16,1,0.3,1); }
.fade-up.visible { opacity: 1; transform: translateY(0); }
.hero-line { display: block; transform: translateY(16px); }
.bb-link { color: ${text(0.45)}; transition: color 0.2s; }
.bb-link:hover { color: ${TEXT}; }
.bb-text-btn { color: ${heroText(0.5)}; transition: color 0.2s; }
.bb-text-btn:hover { color: ${HERO_TEXT}; }
.bb-footer-link { color: ${text(0.3)}; transition: color 0.2s; }
.bb-footer-link:hover { color: ${TEXT}; }
.bb-btn { display: inline-block; transition: transform 0.15s, filter 0.2s, background-color 0.2s; }
.bb-btn:hover { transform: scale(1.02); }
.bb-btn:active { transform: scale(0.97); }
.bb-btn-gold { background: ${GOLD}; color: ${HERO_BG}; }
.bb-btn-gold:hover { filter: brightness(1.08); }
.bb-btn-outline { color: ${GOLD}; }
.bb-btn-outline:hover { background: ${gold(0.08)}; }
.bb-dots { background-image: radial-gradient(${heroWhite(0.07)} 1px, transparent 1px); background-size: 28px 28px; }
.bb-pulse { animation: bb-pulse 2s infinite; }
@keyframes bb-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.6; transform: scale(1.4); } }
.bb-bounce { animation: bb-bounce 1.5s ease-in-out infinite; }
@keyframes bb-bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(8px); } }
.bb-tilt { transition: transform 0.5s; }
.bb-tilt:hover { transform: rotateX(1deg) rotateY(-2deg); }
.bb-marquee { display: flex; width: max-content; animation: bb-marquee 30s linear infinite; }
@keyframes bb-marquee { from { transform: translateX(0); } to { transform: translateX(-33.3333%); } }
.bb-input::placeholder { color: ${text(0.3)}; }
.bb-input-wrap { transition: border-color 0.2s; }
.bb-input-wrap:focus-within { border-color: ${gold(0.4)} !important; }
.bb-social { color: ${text(0.3)}; transition: color 0.2s; }
.bb-social:hover { color: ${TEXT}; }
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  .fade-up, .hero-line { opacity: 1; transform: none; transition: none; }
  .bb-pulse, .bb-bounce, .bb-marquee { animation: none; }
  .bb-tilt:hover, .bb-btn:hover, .bb-btn:active { transform: none; }
}
`;

const navLinks = [
  { label: "Explorer", href: "#dashboard" },
  { label: "Fonctionnalités", href: "#fonctionnalites" },
  { label: "Manifeste", href: "#manifeste" },
];
const footerLinks = ["Manifeste", "Confidentialité", "Contact"];

const heroStats = [
  { value: "2 400+", label: "Curieux inscrits" },
  { value: "6", label: "Mini-jeux" },
  { value: "∞", label: "Sujets à découvrir" },
];

const DIM = text(0.4);
const VIOLET = "#A87FFF";
const GREEN = "#1D9E75";

const stats = [
  { value: "2 400+", label: "Curieux inscrits", color: TEXT },
  { value: "6", label: "Mini-jeux", color: GOLD },
  { value: "∞", label: "Sujets", color: TEXT },
  { value: "0€", label: "Pour commencer", color: GOLD },
];

const previewNav = [
  { icon: "🏠", label: "Mon espace" },
  { icon: "🧭", label: "Explorer" },
  { icon: "🎵", label: "Musique" },
  { icon: "📖", label: "Livres" },
  { icon: "🎮", label: "Jeux" },
  { icon: "✉️", label: "Newsletter" },
];

const previewContacts = [
  { initials: "SA", name: "Sophie A.", tag: "Géopo", background: "#E1F5EE", color: "#0F6E56" },
  { initials: "LR", name: "Léa R.", tag: "Musique", background: "#FAEEDA", color: "#854F0B" },
  { initials: "JD", name: "Jules D.", tag: "Livres", background: "#EEEDFE", color: "#3D4F8C" },
  { initials: "MK", name: "Marc K.", tag: "Philo", background: "#F6E4EC", color: "#8A3F5E" },
];

const previewFilters = ["Tout", "Actualités", "Musique", "Livres", "Science", "Philo", "Art"];

const previewSpaces = [
  { icon: "🎵", title: "Musique", detail: "4 titres" },
  { icon: "📖", title: "Livres", detail: "3 en cours" },
  { icon: "🎙", title: "Podcasts", detail: "2 favoris" },
  { icon: "🎮", title: "Jeux", detail: "Série 7j" },
];

const quizQuestion = "Quel philosophe a théorisé la 'volonté de puissance' ?";
const quizOptions = ["Nietzsche", "Schopenhauer", "Kant", "Spinoza"];

const previewTrends = [
  { topic: "Géopolitique de l'eau", count: "2.4k" },
  { topic: "Floating Points", count: "1.8k" },
  { topic: "Stoïcisme", count: "1.2k" },
  { topic: "Routes arctiques", count: "860" },
];

const newsletterTags = ["Taïwan", "Stoïcisme", "Floating Points"];

const TICKER =
  "Actualités · Culture · Musique · Livres · Mini-jeux · Géopolitique · Philosophie · Science · Art · Histoire · Cinéma · Littérature · Curiosité · ";

const MANIFESTO =
  "Nous croyons que l'ennui est le début de tout. C'est quand rien ne se passe qu'on commence à chercher, à lire, à écouter, à découvrir. BoredBoard est fait pour ces moments-là.";

const readingList = [
  { title: "Sapiens", author: "Y.N. Harari", spine: "#EEEDFE", progress: 48 },
  { title: "La condition humaine", author: "H. Arendt", spine: "#E1F5EE", progress: 12 },
];

const sharedTracks = [
  { title: "Nespole", artist: "Floating Points", color: "rgba(131,77,255,0.35)" },
  { title: "Says", artist: "Nils Frahm", color: "rgba(61,79,140,0.6)" },
  { title: "Gymnopédie n°1", artist: "Erik Satie", color: "rgba(196,169,74,0.4)" },
];

const articles = {
  taiwan: {
    initials: "SA",
    avatarBackground: "#E1F5EE",
    avatarColor: "#0F6E56",
    author: "Sophie A. partage",
    time: "14 min",
    pill: "Géopolitique",
    pillBackground: "rgba(29,158,117,0.12)",
    pillColor: "#1D9E75",
    title: "Détroit de Taïwan : une nouvelle grammaire de la tension",
    source: "Le Monde · lecture 5 min",
  },
  boredom: {
    initials: "MK",
    avatarBackground: "#F6E4EC",
    avatarColor: "#8A3F5E",
    author: "Marc K. partage",
    time: "1 h",
    pill: "Philo",
    pillBackground: "rgba(131,77,255,0.12)",
    pillColor: "#A87FFF",
    title: "Pourquoi l'ennui est le début de la pensée",
    source: "Philosophie Magazine · lecture 4 min",
  },
};

const feedBullets = [
  "Des sujets et des personnes à suivre",
  "Des filtres qui s'appliquent en un clic",
  "Aucun contenu imposé",
];

const miniGames: {
  icon: string;
  title: string;
  players: string;
  background: string;
  border: string;
  badge?: { label: string; background: string; color: string };
}[] = [
  { icon: "🌍", title: "GéoBlitz", players: "1.2k joueurs", background: indigo(0.12), border: indigo(0.2), badge: { label: "Quotidien", background: "rgba(29,158,117,0.15)", color: "#1D9E75" } },
  { icon: "👻", title: "Mot Fantôme", players: "980 joueurs", background: gold(0.06), border: gold(0.15), badge: { label: "Nouveau", background: "rgba(131,77,255,0.15)", color: "#A87FFF" } },
  { icon: "⏳", title: "Chrono", players: "640 joueurs", background: white(0.7), border: CARD_BORDER },
  { icon: "🎧", title: "Blind Test", players: "510 joueurs", background: "rgba(131,77,255,0.08)", border: "rgba(131,77,255,0.18)" },
  { icon: "🗺", title: "Frontières", players: "430 joueurs", background: "rgba(29,158,117,0.08)", border: "rgba(29,158,117,0.18)" },
  { icon: "❝", title: "Qui l'a dit ?", players: "390 joueurs", background: white(0.7), border: CARD_BORDER },
];

const socials = [
  { label: "LinkedIn", glyph: "in" },
  { label: "Twitter", glyph: "𝕏" },
  { label: "Instagram", glyph: "◎" },
];

const previewCard: CSSProperties = {
  background: "rgba(255,255,255,0.85)",
  border: `1px solid ${CARD_BORDER}`,
  borderRadius: 10,
  padding: 12,
};

function FadeUp({
  children,
  delay = 0,
  as: Tag = "div",
  className = "",
  style,
}: {
  children: ReactNode;
  /** Stagger delay in milliseconds. */
  delay?: number;
  as?: "div" | "span";
  className?: string;
  style?: CSSProperties;
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={(element: HTMLElement | null) => {
        ref.current = element;
      }}
      data-delay={delay}
      className={`fade-up ${visible ? "visible" : ""} ${className}`}
      style={{ transitionDelay: `${delay}ms`, ...style }}
    >
      {children}
    </Tag>
  );
}

function Logo({ size = 17 }: { size?: number }) {
  return (
    <span style={{ ...serif, fontSize: size, lineHeight: 1 }}>
      <span style={{ color: "#2A3560" }}>Bored</span>
      <span style={{ color: GOLD }}>Board</span>
    </span>
  );
}

function MiniAvatar({ initials, background, color, size = 20 }: { initials: string; background: string; color: string; size?: number }) {
  return (
    <span className="flex shrink-0 items-center justify-center" style={{ width: size, height: size, background, color, borderRadius: "50%", fontSize: size * 0.4, fontWeight: 600 }}>
      {initials}
    </span>
  );
}

function MiniPill({ children, background, color }: { children: ReactNode; background: string; color: string }) {
  return (
    <span className="shrink-0" style={{ background, color, fontSize: 9, borderRadius: 20, padding: "2px 7px" }}>
      {children}
    </span>
  );
}

function PanelLabel({ children, className = "mb-2" }: { children: ReactNode; className?: string }) {
  return (
    <p className={className} style={{ fontSize: 9, color: text(0.3), letterSpacing: "0.08em", textTransform: "uppercase" }}>
      {children}
    </p>
  );
}

function PanelDivider() {
  return <div className="my-3" style={{ height: 1, background: HAIRLINE }} />;
}

function MiniActions({ likes, comments }: { likes: number; comments: number }) {
  return (
    <div className="mt-2 flex" style={{ gap: 10, fontSize: 10, color: DIM }}>
      <span>♥ {likes}</span>
      <span>·</span>
      <span>💬 {comments}</span>
      <span>·</span>
      <span>🔖</span>
    </div>
  );
}

function ArticleCard({ article, compact = false }: { article: (typeof articles)[keyof typeof articles]; compact?: boolean }) {
  return (
    <div style={previewCard}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <MiniAvatar initials={article.initials} background={article.avatarBackground} color={article.avatarColor} />
          <span className="truncate" style={{ fontSize: 10, color: DIM }}>{article.author}</span>
          <span className="shrink-0" style={{ fontSize: 9, color: DIM }}>{article.time}</span>
        </div>
        <MiniPill background={article.pillBackground} color={article.pillColor}>{article.pill}</MiniPill>
      </div>
      <p className="mt-2" style={{ fontSize: 11, lineHeight: 1.4, color: TEXT }}>{article.title}</p>
      <p className="mt-1" style={{ fontSize: 9, color: DIM }}>{article.source}</p>
      {!compact && <MiniActions likes={47} comments={12} />}
    </div>
  );
}

function DiscoveryCard() {
  return (
    <div style={{ background: indigo(0.06), border: `1px solid ${indigo(0.15)}`, borderRadius: 10, padding: 12 }}>
      <p style={{ fontSize: 9, color: VIOLET }}>✦ Découverte pour toi</p>
      <p className="mt-1" style={{ fontSize: 11, lineHeight: 1.4, color: TEXT }}>
        Le stoïcisme comme antidote au monde hyperconnecté
      </p>
      <p style={{ fontSize: 9, color: DIM }}>Philosophie Magazine · 8 min</p>
      <MiniActions likes={134} comments={31} />
    </div>
  );
}

function MusicCard() {
  return (
    <div style={previewCard}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <MiniAvatar initials="LR" background="#FAEEDA" color="#854F0B" />
          <span className="truncate" style={{ fontSize: 10, color: DIM }}>Léa R. écoute</span>
        </div>
        <MiniPill background="rgba(131,77,255,0.12)" color={VIOLET}>Musique</MiniPill>
      </div>
      <div className="mt-2 flex items-center gap-2.5">
        <span className="shrink-0" style={{ width: 36, height: 36, background: black(0.06), borderRadius: 8 }} />
        <div className="min-w-0">
          <p style={{ fontSize: 11, color: TEXT }}>Nespole</p>
          <p className="truncate" style={{ fontSize: 9, color: DIM }}>Floating Points · Elaenia</p>
        </div>
      </div>
      <div className="mt-2" style={{ height: 2, background: black(0.08), borderRadius: 2 }}>
        <div style={{ height: 2, width: "42%", background: INDIGO, borderRadius: 2 }} />
      </div>
      <div className="mt-1 flex items-center" style={{ gap: 10, fontSize: 10, color: DIM }}>
        <span>⏮</span>
        <span>▶</span>
        <span>⏭</span>
        <span className="ml-auto">♥</span>
      </div>
    </div>
  );
}

function BookCard() {
  return (
    <div style={previewCard}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <MiniAvatar initials="JD" background="#EEEDFE" color="#3D4F8C" />
          <span className="truncate" style={{ fontSize: 10, color: DIM }}>Jules D. lit</span>
        </div>
        <MiniPill background="rgba(29,158,117,0.12)" color={GREEN}>Livres</MiniPill>
      </div>
      <p className="mt-2 pl-2" style={{ fontStyle: "italic", fontSize: 10, lineHeight: 1.5, color: text(0.5), borderLeft: `2px solid ${gold(0.3)}` }}>
        Les grands récits fictifs donnent à l&apos;humanité sa cohésion.
      </p>
      <div className="mt-2 flex items-center gap-2">
        <span className="shrink-0" style={{ width: 28, height: 28, background: "#EEEDFE", borderRadius: 3 }} />
        <div className="min-w-0">
          <p style={{ fontSize: 10, color: TEXT }}>Sapiens</p>
          <p style={{ fontSize: 9, color: DIM }}>Y. N. Harari</p>
        </div>
        <div className="ml-auto" style={{ width: 64, height: 2, background: black(0.08), borderRadius: 2 }}>
          <div style={{ height: 2, width: "48%", background: GOLD, borderRadius: 2 }} />
        </div>
      </div>
    </div>
  );
}

function ReadingCard() {
  return (
    <div style={{ background: white(0.7), border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 14 }}>
      <PanelLabel className="mb-3">En cours de lecture</PanelLabel>
      <ul className="flex flex-col gap-3">
        {readingList.map((book) => (
          <li key={book.title} className="flex items-center gap-2.5">
            <span className="shrink-0" style={{ width: 28, height: 38, background: book.spine, borderRadius: 3 }} />
            <div className="min-w-0 flex-1">
              <p className="truncate" style={{ fontSize: 11, color: TEXT }}>{book.title}</p>
              <p className="truncate" style={{ fontSize: 9, color: DIM }}>{book.author}</p>
              <div className="mt-1.5 flex items-center gap-2">
                <div className="flex-1" style={{ height: 2, background: black(0.08), borderRadius: 2 }}>
                  <div style={{ height: 2, width: `${book.progress}%`, background: GOLD, borderRadius: 2 }} />
                </div>
                <span style={{ fontSize: 9, color: GOLD }}>{book.progress}%</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SharedMusicCard() {
  return (
    <div style={{ background: white(0.7), border: `1px solid ${CARD_BORDER}`, borderRadius: 12, padding: 14 }}>
      <PanelLabel className="mb-3">Partagé par Léa R.</PanelLabel>
      <ul className="flex flex-col gap-2.5">
        {sharedTracks.map((track) => (
          <li key={track.title} className="flex items-center gap-2.5">
            <span className="shrink-0" style={{ width: 28, height: 28, background: track.color, borderRadius: 6 }} />
            <div className="min-w-0">
              <p className="truncate" style={{ fontSize: 11, color: TEXT }}>{track.title}</p>
              <p className="truncate" style={{ fontSize: 9, color: DIM }}>{track.artist}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FilterPills({ filters }: { filters: string[] }) {
  return (
    <div className="flex flex-nowrap overflow-hidden" style={{ gap: 6 }}>
      {filters.map((filter, index) => (
        <span
          key={filter}
          className="shrink-0"
          style={{
            fontSize: 10,
            padding: "3px 10px",
            borderRadius: 20,
            background: index === 0 ? gold(0.15) : black(0.05),
            color: index === 0 ? GOLD : DIM,
          }}
        >
          {filter}
        </span>
      ))}
    </div>
  );
}

function DashboardPreview() {
  return (
    <div className="grid grid-cols-[200px_1fr_220px]" style={{ background: "#EDE7DC", minHeight: 500, minWidth: 780 }}>
      <aside style={{ background: black(0.03), borderRight: `1px solid ${HAIRLINE}`, padding: "20px 14px" }}>
        <p className="mb-4" style={{ ...serif, fontSize: 18, color: GOLD }}>BB</p>
        <ul className="flex flex-col" style={{ gap: 4 }}>
          {previewNav.map((item, index) => (
            <li
              key={item.label}
              className="flex items-center"
              style={{
                padding: "8px 10px",
                borderRadius: 8,
                fontSize: 11,
                gap: 8,
                background: index === 0 ? black(0.06) : "transparent",
                color: index === 0 ? TEXT : DIM,
              }}
            >
              <span aria-hidden>{item.icon}</span>
              {item.label}
            </li>
          ))}
        </ul>
        <div className="my-4" style={{ height: 1, background: HAIRLINE }} />
        <PanelLabel>Abonnements</PanelLabel>
        <ul className="flex flex-col" style={{ gap: 6 }}>
          {previewContacts.map((contact) => (
            <li key={contact.initials} className="flex items-center gap-2">
              <MiniAvatar initials={contact.initials} background={contact.background} color={contact.color} />
              <span style={{ fontSize: 10, color: DIM }}>
                {contact.name} · {contact.tag}
              </span>
            </li>
          ))}
        </ul>
      </aside>

      <div className="flex min-w-0 flex-col overflow-hidden" style={{ padding: 16, gap: 10 }}>
        <FilterPills filters={previewFilters} />
        <ArticleCard article={articles.taiwan} />
        <MusicCard />
        <DiscoveryCard />
        <BookCard />
      </div>

      <aside style={{ background: black(0.03), borderLeft: `1px solid ${HAIRLINE}`, padding: "20px 14px" }}>
        <PanelLabel className="mb-3">Mes espaces</PanelLabel>
        <div className="grid grid-cols-2" style={{ gap: 6 }}>
          {previewSpaces.map((space) => (
            <div key={space.title} style={{ background: white(0.8), borderRadius: 8, padding: 8 }}>
              <p aria-hidden style={{ fontSize: 14, opacity: 0.6 }}>{space.icon}</p>
              <p style={{ fontSize: 9, color: TEXT }}>{space.title}</p>
              <p style={{ fontSize: 8, color: DIM }}>{space.detail}</p>
            </div>
          ))}
        </div>

        <PanelDivider />
        <PanelLabel>Quiz du jour</PanelLabel>
        <div style={{ background: white(0.7), borderRadius: 8, padding: 10 }}>
          <p style={{ fontSize: 10, lineHeight: 1.4, color: TEXT }}>{quizQuestion}</p>
          <div className="mt-2 grid grid-cols-2" style={{ gap: 4 }}>
            {quizOptions.map((option) => (
              <span key={option} className="truncate text-center" style={{ background: white(0.8), borderRadius: 6, fontSize: 9, color: DIM, padding: "5px 7px" }}>
                {option}
              </span>
            ))}
          </div>
        </div>

        <PanelDivider />
        <PanelLabel>Tendances</PanelLabel>
        <ul className="flex flex-col gap-1.5">
          {previewTrends.map((trend) => (
            <li key={trend.topic} className="flex items-center justify-between gap-2">
              <span className="truncate" style={{ fontSize: 10, color: TEXT }}>{trend.topic}</span>
              <span style={{ fontSize: 9, color: GOLD }}>{trend.count}</span>
            </li>
          ))}
        </ul>

        <PanelDivider />
        <PanelLabel>Ta newsletter · demain</PanelLabel>
        <div style={{ background: gold(0.04), border: `1px solid ${gold(0.1)}`, borderRadius: 8, padding: 8 }}>
          <p className="mb-1" style={{ fontSize: 10, color: TEXT }}>Curio Daily</p>
          <div className="flex flex-wrap gap-1">
            {newsletterTags.map((tag) => (
              <span key={tag} style={{ fontSize: 8, background: white(0.8), borderRadius: 10, padding: "2px 6px", color: text(0.6) }}>
                {tag}
              </span>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}

function FeatureRow({
  number,
  title,
  description,
  bullets,
  reverse = false,
  children,
}: {
  number: string;
  title: string;
  description: string;
  bullets?: string[];
  reverse?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-1 items-center md:grid-cols-2" style={{ gap: 60 }}>
      <FadeUp className={reverse ? "md:order-2" : ""}>
        <p style={{ ...serif, fontSize: 56, lineHeight: 1, color: gold(0.2) }}>{number}</p>
        <h3 className="mt-2" style={{ ...serif, fontSize: 28, lineHeight: 1.2, color: TEXT }}>{title}</h3>
        <p className="mt-3" style={{ fontSize: 14, lineHeight: 1.75, color: DIM }}>{description}</p>
        {bullets && (
          <ul className="mt-4 flex flex-col" style={{ gap: 10 }}>
            {bullets.map((bullet) => (
              <li key={bullet} className="flex items-center gap-3">
                <span className="shrink-0" style={{ width: 6, height: 6, background: GOLD }} />
                <span style={{ fontSize: 13, color: DIM }}>{bullet}</span>
              </li>
            ))}
          </ul>
        )}
      </FadeUp>
      <FadeUp delay={150} className={`min-w-0 ${reverse ? "md:order-1" : ""}`}>
        {children}
      </FadeUp>
    </div>
  );
}

export default function Home() {
  const router = useRouter();

  // A signed-in visitor goes straight to their dashboard.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) router.replace("/dashboard");
    });
  }, [router]);

  const handleJoin = (event: FormEvent) => {
    event.preventDefault();
    router.push("/signup");
  };

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ ...sans, background: BG, color: TEXT }}>
      <style>{css}</style>
      <noscript>
        <style>{".fade-up, .hero-line { opacity: 1; transform: none; }"}</style>
      </noscript>

      <header
        className="fixed left-0 top-0 z-50 w-full"
        style={{
          background: "rgba(247,244,238,0.92)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderBottom: `1px solid ${HAIRLINE}`,
        }}
      >
        <nav className="mx-auto flex h-14 max-w-[1100px] items-center justify-between px-5 md:px-[60px]">
          <Link href="/">
            <Logo />
          </Link>
          <ul className="hidden md:flex" style={{ gap: 28 }}>
            {navLinks.map((link) => (
              <li key={link.label}>
                <a href={link.href} className="bb-link" style={{ fontSize: 13 }}>
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="flex items-center gap-4">
            <Link href="/login" className="bb-link" style={{ fontSize: 13 }}>
              Connexion
            </Link>
            <Link href="/signup" className="bb-btn bb-btn-outline" style={{ border: `1px solid ${gold(0.5)}`, borderRadius: 20, padding: "6px 16px", fontSize: 13 }}>
              Rejoindre
            </Link>
          </div>
        </nav>
      </header>

      <main>
        {/* Section 1 — Hero */}
        <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-5 pb-20 pt-28 text-center" style={{ background: HERO_BG }}>
          <div aria-hidden className="bb-dots absolute inset-0" />
          <div
            aria-hidden
            className="absolute"
            style={{
              width: 700,
              height: 700,
              top: -200,
              left: "50%",
              transform: "translateX(-60%)",
              background: `radial-gradient(circle, ${indigo(0.18)} 0%, transparent 65%)`,
            }}
          />
          <div
            aria-hidden
            className="absolute"
            style={{
              width: 500,
              height: 500,
              top: 100,
              right: -100,
              background: `radial-gradient(circle, ${gold(0.1)} 0%, transparent 65%)`,
            }}
          />

          <div className="relative flex flex-col items-center">
            <FadeUp>
              <p
                className="inline-flex items-center gap-2"
                style={{
                  border: `1px solid ${gold(0.3)}`,
                  background: gold(0.05),
                  color: GOLD,
                  fontSize: 10,
                  letterSpacing: "0.2em",
                  borderRadius: 20,
                  padding: "5px 16px",
                  marginBottom: 32,
                }}
              >
                <span className="bb-pulse" style={{ width: 6, height: 6, background: GOLD, borderRadius: "50%" }} />
                BETA PRIVÉE · 2026
              </p>
            </FadeUp>

            <h1
              style={{
                ...serif,
                fontSize: "clamp(38px, 8.5vw, 68px)",
                lineHeight: 1.05,
                letterSpacing: "-2px",
                color: HERO_TEXT,
                maxWidth: 700,
              }}
            >
              <FadeUp as="span" delay={100} className="hero-line">
                L&apos;endroit où
              </FadeUp>
              <FadeUp as="span" delay={250} className="hero-line">
                ton ennui devient
              </FadeUp>
              <FadeUp as="span" delay={400} className="hero-line" style={{ color: GOLD, fontStyle: "italic" }}>
                une richesse.
              </FadeUp>
            </h1>

            <FadeUp delay={550}>
              <p style={{ fontSize: 15, lineHeight: 1.8, color: heroText(0.45), maxWidth: 460, marginTop: 28 }}>
                Actualités, culture, musique, livres, mini-jeux — tout ce qui
                éveille ta curiosité, dans un seul endroit.
              </p>
            </FadeUp>

            <FadeUp delay={650}>
              <div className="flex flex-wrap items-center justify-center" style={{ marginTop: 44, gap: 12 }}>
                <Link href="/signup" className="bb-btn bb-btn-gold" style={{ fontSize: 13, fontWeight: 600, padding: "13px 28px", borderRadius: 24 }}>
                  Rejoindre gratuitement
                </Link>
                <a href="#dashboard" className="bb-text-btn" style={{ fontSize: 13, padding: "13px 12px" }}>
                  Explorer sans compte →
                </a>
              </div>
            </FadeUp>

            <FadeUp delay={750}>
              <div className="flex flex-wrap items-center justify-center" style={{ marginTop: 56, columnGap: 48, rowGap: 20 }}>
                {heroStats.map((stat, index) => (
                  <div key={stat.label} className="flex items-center" style={{ gap: 48 }}>
                    {index > 0 && (
                      <span aria-hidden className="hidden sm:block" style={{ width: 1, height: 32, background: heroWhite(0.08) }} />
                    )}
                    <div>
                      <p style={{ ...serif, fontSize: 28, color: HERO_TEXT }}>{stat.value}</p>
                      <p style={{ fontSize: 11, color: heroText(0.35) }}>{stat.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </FadeUp>
          </div>

          <a href="#dashboard" aria-label="Découvrir la suite" className="absolute" style={{ bottom: 24 }}>
            <svg className="bb-bounce" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={heroText(0.3)} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M12 5v14M6 13l6 6 6-6" />
            </svg>
          </a>
        </section>

        {/* Ticker */}
        <div
          aria-hidden
          className="overflow-hidden"
          style={{ background: gold(0.08), borderTop: `1px solid ${gold(0.2)}`, borderBottom: `1px solid ${gold(0.2)}`, padding: "14px 0" }}
        >
          <div className="bb-marquee" style={{ fontSize: 11, letterSpacing: "0.15em", color: gold(0.5), whiteSpace: "pre" }}>
            {[0, 1, 2].map((copy) => (
              <span key={copy}>{TICKER}</span>
            ))}
          </div>
        </div>

        {/* Section 2 — Dashboard cinématique */}
        <section id="dashboard" style={{ background: BG, paddingBottom: 120 }}>
          <FadeUp className="px-5 text-center" style={{ paddingTop: 80, marginBottom: -20 }}>
            <p style={{ fontSize: 10, letterSpacing: "0.2em", color: GOLD }}>APERÇU</p>
            <h2 className="mt-3" style={{ ...serif, fontSize: "clamp(28px, 5vw, 38px)", color: TEXT }}>
              Tout ce qui t&apos;intéresse.
            </h2>
            <p className="mt-2" style={{ fontSize: 14, color: DIM }}>
              Un seul écran pour lire, écouter, jouer et suivre ceux qui t&apos;inspirent.
            </p>
          </FadeUp>

          <FadeUp delay={100} className="mx-auto max-w-[1100px] px-5 md:px-10" style={{ marginTop: 60, perspective: 1200 }}>
            <div
              className="bb-tilt overflow-hidden"
              style={{
                borderRadius: 24,
                border: `1px solid ${CARD_BORDER}`,
                boxShadow: `0 0 0 1px ${black(0.05)}, 0 60px 120px rgba(28,26,21,0.16), 0 0 80px ${indigo(0.06)}, 0 40px 120px ${indigo(0.12)}`,
              }}
            >
              <div className="relative flex items-center" style={{ background: black(0.04), borderBottom: `1px solid ${HAIRLINE}`, padding: "12px 16px" }}>
                <div className="flex" style={{ gap: 6 }}>
                  {["#FF5F57", "#FFBD2E", "#28C840"].map((color) => (
                    <span key={color} style={{ width: 10, height: 10, background: color, borderRadius: "50%" }} />
                  ))}
                </div>
                <p className="absolute inset-x-0 text-center" style={{ fontSize: 11, color: text(0.2), fontFamily: "ui-monospace, Menlo, monospace" }}>
                  <span aria-hidden className="mr-1.5" style={{ opacity: 0.6 }}>🔒</span>
                  boredboard.com
                </p>
              </div>
              {/* Narrow screens scroll sideways rather than dropping a column. */}
              <div className="overflow-x-auto">
                <DashboardPreview />
              </div>
            </div>
          </FadeUp>
        </section>

        {/* Section 3 — Features alternées */}
        <section id="fonctionnalites" style={{ background: SURFACE, borderTop: `1px solid ${HAIRLINE}`, padding: "100px 0" }}>
          <div className="mx-auto flex max-w-[1000px] flex-col px-5 md:px-[60px]" style={{ gap: 80 }}>
            <FeatureRow
              number="01"
              title="Ton feed, façonné par toi."
              description="Abonne-toi à des sujets et à des gens. Filtre en un clic. BoredBoard n'impose rien — il amplifie ce que tu choisis."
              bullets={feedBullets}
            >
              <div className="flex flex-col" style={{ background: white(0.7), border: `1px solid ${CARD_BORDER}`, borderRadius: 14, padding: 16, gap: 10 }}>
                <FilterPills filters={["Tout", "Géopo", "Musique", "Science", "Art"]} />
                <ArticleCard article={articles.taiwan} compact />
                <ArticleCard article={articles.boredom} compact />
              </div>
            </FeatureRow>

            <FeatureRow
              number="02"
              title="Joue, découvre, refais."
              description="Six mini-jeux quotidiens — géographie, mots, histoire, musique. Deux minutes suffisent pour apprendre quelque chose de nouveau."
              reverse
            >
              <div className="grid grid-cols-2" style={{ gap: 10 }}>
                {miniGames.map((game) => (
                  <div key={game.title} style={{ background: game.background, border: `1px solid ${game.border}`, borderRadius: 12, padding: 14 }}>
                    <div className="flex items-start justify-between gap-2">
                      <p aria-hidden style={{ fontSize: 18 }}>{game.icon}</p>
                      {game.badge && (
                        <span style={{ background: game.badge.background, color: game.badge.color, fontSize: 9, borderRadius: 20, padding: "2px 7px" }}>
                          {game.badge.label}
                        </span>
                      )}
                    </div>
                    <p className="mt-2" style={{ fontSize: 12, color: TEXT }}>{game.title}</p>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <span style={{ fontSize: 10, color: GOLD }}>Jouer →</span>
                      <span style={{ fontSize: 9, color: DIM }}>{game.players}</span>
                    </div>
                  </div>
                ))}
              </div>
            </FeatureRow>

            <FeatureRow
              number="03"
              title="Tes livres et ta musique, partagés."
              description="Montre ce que tu lis, partage ce que tu écoutes. Inspire tes contacts. Découvre ce qui les inspire."
            >
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
                <ReadingCard />
                <SharedMusicCard />
              </div>
            </FeatureRow>
          </div>
        </section>

        {/* Manifeste */}
        <section id="manifeste" style={{ background: SURFACE, borderTop: `1px solid ${HAIRLINE}` }}>
          <FadeUp className="mx-auto max-w-[700px] px-5 py-20 text-center md:px-[60px]">
            <blockquote style={{ ...serif, fontSize: "clamp(19px, 3.6vw, 24px)", fontStyle: "italic", lineHeight: 1.6, color: TEXT }}>
              « {MANIFESTO} »
            </blockquote>
            <p className="mt-4" style={{ fontSize: 12, color: gold(0.6) }}>
              — L&apos;équipe BoredBoard
            </p>
          </FadeUp>
        </section>

        {/* Section 4 — Stats band */}
        <section style={{ background: BG, borderTop: `1px solid ${HAIRLINE}`, padding: "60px 20px" }}>
          <div className="flex flex-wrap items-center justify-center text-center" style={{ columnGap: 80, rowGap: 32 }}>
            {stats.map((stat, index) => (
              <div key={stat.label} className="flex items-center" style={{ gap: 80 }}>
                {index > 0 && (
                  <span aria-hidden className="hidden lg:block" style={{ width: 1, height: 48, background: black(0.08) }} />
                )}
                <FadeUp delay={index * 100}>
                  <p style={{ ...serif, fontSize: 44, lineHeight: 1.1, color: stat.color }}>{stat.value}</p>
                  <p className="mt-1" style={{ fontSize: 12, color: text(0.35) }}>{stat.label}</p>
                </FadeUp>
              </div>
            ))}
          </div>
        </section>

        {/* Section 5 — CTA */}
        <section className="relative overflow-hidden px-5 py-[120px] text-center md:px-[60px]" style={{ background: SURFACE2, borderTop: `1px solid ${HAIRLINE}` }}>
          <div
            aria-hidden
            className="absolute"
            style={{
              width: 800,
              height: 800,
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
              background: `radial-gradient(circle, ${indigo(0.08)} 0%, transparent 60%)`,
            }}
          />
          <FadeUp className="relative">
            <p className="mb-4" style={{ fontSize: 10, letterSpacing: "0.2em", color: GOLD }}>REJOINDRE</p>
            <h2 className="mb-3" style={{ ...serif, fontSize: "clamp(34px, 8vw, 52px)", lineHeight: 1.1, color: TEXT }}>
              Prêt à rejoindre
              <br />
              les curieux ?
            </h2>
            <p className="mb-10" style={{ fontSize: 14, color: DIM }}>
              Crée ton espace et compose ton premier dashboard en deux minutes.
            </p>

            <form
              onSubmit={handleJoin}
              className="bb-input-wrap mx-auto flex"
              style={{ maxWidth: 400, border: `1px solid ${black(0.12)}`, background: white(0.8), borderRadius: 28, padding: 4 }}
            >
              <input
                type="email"
                name="email"
                required
                placeholder="ton@email.fr"
                aria-label="Adresse email"
                className="bb-input min-w-0 flex-1"
                style={{ background: "transparent", border: "none", outline: "none", color: TEXT, padding: "0 20px", fontSize: 14 }}
              />
              <button type="submit" className="bb-btn bb-btn-gold shrink-0" style={{ fontWeight: 600, borderRadius: 24, padding: "12px 22px", fontSize: 13 }}>
                Rejoindre
              </button>
            </form>
            <p className="mt-3 text-center" style={{ fontSize: 11, color: text(0.2) }}>
              Gratuit · Sans carte bancaire
            </p>
          </FadeUp>
        </section>
      </main>

      <footer className="px-5 md:px-[60px]" style={{ background: SURFACE2, borderTop: `1px solid ${HAIRLINE}`, paddingTop: 48, paddingBottom: 48 }}>
        <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-3">
          <div>
            <Logo size={16} />
            <p className="mt-1" style={{ fontSize: 12, color: text(0.25) }}>Pour les esprits curieux.</p>
            <p className="mt-3" style={{ fontSize: 11, color: text(0.2) }}>© 2026 BoredBoard</p>
            <p className="mt-1" style={{ fontSize: 10, fontStyle: "italic", color: text(0.15) }}>
              Construit avec curiosité à Paris, 2026
            </p>
          </div>
          <ul className="flex md:justify-center" style={{ gap: 24 }}>
            {footerLinks.map((link) => (
              <li key={link}>
                <a href={link === "Manifeste" ? "#manifeste" : "#"} className="bb-footer-link" style={{ fontSize: 12 }}>
                  {link}
                </a>
              </li>
            ))}
          </ul>
          <ul className="flex md:justify-end" style={{ gap: 18 }}>
            {socials.map((social) => (
              <li key={social.label}>
                <a href="#" aria-label={social.label} title={social.label} className="bb-social" style={{ fontSize: 15, fontWeight: 600 }}>
                  {social.glyph}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </footer>
    </div>
  );
}

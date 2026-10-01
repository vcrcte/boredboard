"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import Navbar, { getInitials } from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

const filters = [
  "Tout",
  "Actualités",
  "Musique",
  "Livres",
  "Podcasts",
  "Découvertes",
];

const icons = {
  home: (
    <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1v-8.5Z" />
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5 5-2Z" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </>
  ),
  book: (
    <>
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2Z" />
      <path d="M12 6.5v13" />
    </>
  ),
  puzzle: (
    <path d="M10 3.5a2 2 0 1 1 4 0V5h4a1 1 0 0 1 1 1v4h1.5a2 2 0 1 1 0 4H19v5a1 1 0 0 1-1 1h-4.5v-1.5a2 2 0 1 0-4 0V20H5a1 1 0 0 1-1-1v-4.5h1.5a2 2 0 1 0 0-4H4V6a1 1 0 0 1 1-1h5V3.5Z" />
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3.5 7 8.5 6 8.5-6" />
    </>
  ),
  mic: (
    <>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
    </>
  ),
  like: (
    <path d="M12 20s-7.5-4.4-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10Z" />
  ),
  comment: <path d="M4 5.5h16v11H10l-4.5 3.5v-3.5H4v-11Z" />,
  share: (
    <>
      <path d="M12 15V4" />
      <path d="m7.5 8 4.5-4.5L16.5 8" />
      <path d="M5 13v6h14v-6" />
    </>
  ),
  bookmark: <path d="M6.5 4h11v16.5l-5.5-4-5.5 4V4Z" />,
  sparkle: (
    <>
      <path d="M11 4l1.8 5.2L18 11l-5.2 1.8L11 18l-1.8-5.2L4 11l5.2-1.8L11 4Z" />
      <path d="M18.5 3.5v3M17 5h3M19 17v3M17.5 18.5h3" />
    </>
  ),
  play: <path d="M8 5.5v13l10.5-6.5L8 5.5Z" />,
  pause: <path d="M8 5.5v13M16 5.5v13" />,
  previous: <path d="M18 6v12l-9-6 9-6ZM6 6v12" />,
  next: <path d="M6 6v12l9-6-9-6ZM18 6v12" />,
};

type IconName = keyof typeof icons;

// Sidebar entries and spaces without a `filter` have no destination yet.
const sidebarIcons: { name: IconName; label: string; filter?: string }[] = [
  { name: "home", label: "Accueil", filter: "Tout" },
  { name: "compass", label: "Découvertes", filter: "Découvertes" },
  { name: "music", label: "Musique", filter: "Musique" },
  { name: "book", label: "Livres", filter: "Livres" },
  { name: "puzzle", label: "Jeux" },
  { name: "mail", label: "Newsletter" },
];

const spaces: { name: IconName; label: string; bg: string; color: string; filter?: string }[] = [
  { name: "music", label: "Musique", bg: "bg-[#F1ECF8]", color: "text-[#7A5AA6]", filter: "Musique" },
  { name: "book", label: "Livres", bg: "bg-[#FDF7E8]", color: "text-[#9A8232]", filter: "Livres" },
  { name: "mic", label: "Podcasts", bg: "bg-[#EEF0F8]", color: "text-[#2A3560]", filter: "Podcasts" },
  { name: "puzzle", label: "Jeux", bg: "bg-[#E8F4EE]", color: "text-[#3F8560]" },
];

const pillStyles = {
  green: "bg-[#E8F4EE] text-[#3F8560]",
  violet: "bg-[#F1ECF8] text-[#7A5AA6]",
  gold: "bg-[#FDF7E8] text-[#9A8232]",
};

const tracks = [
  { title: "Gymnopédie n°1", artist: "Erik Satie", duration: 192 },
  { title: "Clair de lune", artist: "Claude Debussy", duration: 303 },
  { title: "Spiegel im Spiegel", artist: "Arvo Pärt", duration: 498 },
];

const following = [
  { name: "Sophie A.", tag: "Géopolitique", color: "bg-[#5B9A78]" },
  { name: "Léa R.", tag: "Musique", color: "bg-[#8B6BB5]" },
  { name: "Jules D.", tag: "Littérature", color: "bg-[#C4A94A]" },
  { name: "Malik T.", tag: "Philosophie", color: "bg-[#3D4F8C]" },
  { name: "Inès B.", tag: "Architecture", color: "bg-[#B5746B]" },
];

const trends = [
  { topic: "Détroit de Taïwan", count: "128 partages" },
  { topic: "Erik Satie", count: "64 écoutes" },
  { topic: "Stoïcisme", count: "51 lectures" },
  { topic: "Routes arctiques", count: "37 partages" },
];

const newsletterTags = ["Géopolitique", "Musique", "Littérature"];

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

function Icon({
  name,
  className = "h-[18px] w-[18px]",
  filled = false,
}: {
  name: IconName;
  className?: string;
  filled?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {icons[name]}
    </svg>
  );
}

function Avatar({ initials, color }: { initials: string; color: string }) {
  return (
    <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-white ${color}`}>
      {initials}
    </span>
  );
}

function CardHeader({
  pill,
  tone,
  avatar,
  meta,
}: {
  pill: string;
  tone: keyof typeof pillStyles;
  avatar: ReactNode;
  meta: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#888780]">
      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${pillStyles[tone]}`}>
        {pill}
      </span>
      <span>·</span>
      {avatar}
      <span>{meta}</span>
    </div>
  );
}

function Card({ children }: { children: ReactNode }) {
  return (
    <article className="rounded-[10px] border border-[#E8E8E8] bg-white p-5">
      {children}
    </article>
  );
}

function Actions({ likes, comments }: { likes: number; comments: number }) {
  const [active, setActive] = useState({
    like: false,
    comment: false,
    share: false,
    bookmark: false,
  });

  const actions: { name: keyof typeof active; label: string; count?: number }[] = [
    { name: "like", label: "Aimer", count: likes + (active.like ? 1 : 0) },
    { name: "comment", label: "Commenter", count: comments },
    { name: "share", label: "Partager" },
    { name: "bookmark", label: "Enregistrer" },
  ];

  return (
    <div className="mt-4 flex items-center gap-5 border-t border-[#E8E8E8] pt-3">
      {actions.map((action) => (
        <button
          key={action.name}
          type="button"
          onClick={() => setActive({ ...active, [action.name]: !active[action.name] })}
          aria-label={action.label}
          aria-pressed={active[action.name]}
          className={`flex items-center gap-1.5 text-[11px] transition-colors hover:text-[#2A3560] ${
            action.name === "bookmark" ? "ml-auto" : ""
          } ${active[action.name] ? "text-[#2A3560]" : "text-[#888780]"}`}
        >
          <Icon name={action.name} className="h-4 w-4" filled={active[action.name]} />
          {action.count}
        </button>
      ))}
    </div>
  );
}

function Player() {
  const [trackIndex, setTrackIndex] = useState(0);
  const [elapsed, setElapsed] = useState(118);
  const [playing, setPlaying] = useState(false);
  const track = tracks[trackIndex];

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => {
      setElapsed((current) => Math.min(current + 1, track.duration));
    }, 1000);
    return () => clearInterval(timer);
  }, [playing, track.duration]);

  const skip = (step: number) => {
    setTrackIndex((trackIndex + step + tracks.length) % tracks.length);
    setElapsed(0);
  };

  const controls: { name: IconName; label: string; onClick: () => void }[] = [
    { name: "previous", label: "Morceau précédent", onClick: () => skip(-1) },
    {
      name: playing ? "pause" : "play",
      label: playing ? "Pause" : "Lecture",
      onClick: () => setPlaying(!playing),
    },
    { name: "next", label: "Morceau suivant", onClick: () => skip(1) },
  ];

  return (
    <div className="mt-3 flex items-center gap-4 rounded-[10px] bg-[#F5F4F0] p-3.5">
      <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-md bg-[#EEF0F8] text-[#3D4F8C]">
        <Icon name="music" className="h-6 w-6" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-[#1C1B2E]">
          {track.title}
        </p>
        <p className="truncate text-[11px] text-[#888780]">{track.artist}</p>
        <div className="mt-2.5 h-1 rounded-full bg-white">
          <div
            className="h-1 rounded-full bg-[#3D4F8C]"
            style={{ width: `${(elapsed / track.duration) * 100}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-[#888780]">
          <span>{formatTime(elapsed)}</span>
          <span>{formatTime(track.duration)}</span>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {controls.map((control, index) => (
          <button
            key={control.label}
            type="button"
            onClick={control.onClick}
            aria-label={control.label}
            className={
              index === 1
                ? "flex h-9 w-9 items-center justify-center rounded-full bg-[#2A3560] text-white transition-colors hover:bg-[#3D4F8C]"
                : "flex h-7 w-7 items-center justify-center text-[#888780] transition-colors hover:text-[#2A3560]"
            }
          >
            <Icon name={control.name} className="h-4 w-4" filled={control.name !== "pause"} />
          </button>
        ))}
      </div>
    </div>
  );
}

function SidebarTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888780]">
      {children}
    </h2>
  );
}

const cards = [
  {
    category: "Actualités",
    content: (
      <Card>
        <CardHeader
          pill="Géopolitique"
          tone="green"
          avatar={<Avatar initials="S" color="bg-[#5B9A78]" />}
          meta="Sophie A. partage · il y a 14 min"
        />
        <h2 className="mt-3 font-serif text-[18px] leading-snug text-[#1C1B2E]">
          Détroit de Taïwan : derrière la manœuvre navale, une nouvelle
          grammaire de la tension
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#888780]">
          Au-delà du nombre de navires, c&apos;est le vocabulaire employé par
          chaque camp qui change. Décryptage d&apos;une escalade qui se joue
          autant dans les mots que sur l&apos;eau.
        </p>
        <p className="mt-3 text-[11px] text-[#888780]">
          Le Monde · lecture 5 min
        </p>
        <Actions likes={24} comments={6} />
      </Card>
    ),
  },
  {
    category: "Musique",
    content: (
      <Card>
        <CardHeader
          pill="Musique"
          tone="violet"
          avatar={<Avatar initials="L" color="bg-[#8B6BB5]" />}
          meta="Léa R. écoute · il y a 38 min"
        />
        <Player />
        <Actions likes={41} comments={3} />
      </Card>
    ),
  },
  {
    category: "Découvertes",
    content: (
      <Card>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FDF7E8] px-2.5 py-1 text-[10px] font-medium text-[#9A8232]">
          <Icon name="sparkle" className="h-3.5 w-3.5" />
          Découverte pour toi
        </span>
        <h2 className="mt-3 font-serif text-[18px] leading-snug text-[#1C1B2E]">
          Le wabi-sabi, ou l&apos;art de trouver la beauté dans ce qui est
          imparfait
        </h2>
        <p className="mt-2 text-[13px] leading-relaxed text-[#888780]">
          Un bol fêlé, un mur patiné, une saison qui finit : cette esthétique
          japonaise fait de l&apos;usure et de l&apos;inachevé une forme
          d&apos;élégance.
        </p>
        <p className="mt-3 text-[11px] text-[#888780]">
          Philosophie Magazine · lecture 4 min
        </p>
        <Actions likes={58} comments={9} />
      </Card>
    ),
  },
  {
    category: "Livres",
    content: (
      <Card>
        <CardHeader
          pill="Livres"
          tone="gold"
          avatar={<Avatar initials="J" color="bg-[#C4A94A]" />}
          meta="Jules D. lit · il y a 2 h"
        />
        <p className="mt-3 font-serif text-[15px] italic leading-relaxed text-[#1C1B2E]">
          « Une réalité imaginaire n&apos;est pas un mensonge : c&apos;est une
          chose à laquelle tout le monde croit. »
        </p>
        <div className="mt-4 flex items-center gap-3.5 rounded-[10px] bg-[#F5F4F0] p-3.5">
          <span className="flex h-14 w-10 shrink-0 items-center justify-center rounded-[3px] bg-[#FDF7E8] font-serif text-[18px] text-[#C4A94A]">
            S
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-serif text-[14px] text-[#1C1B2E]">Sapiens</p>
            <p className="text-[11px] text-[#888780]">Yuval Noah Harari</p>
            <div className="mt-2 flex items-center gap-2.5">
              <div className="h-1 flex-1 rounded-full bg-white">
                <div className="h-1 w-[48%] rounded-full bg-[#C4A94A]" />
              </div>
              <span className="text-[11px] font-medium text-[#C4A94A]">48%</span>
            </div>
          </div>
        </div>
        <Actions likes={17} comments={2} />
      </Card>
    ),
  },
];

export default function Dashboard() {
  const router = useRouter();
  // undefined while the session is still being read, null once known to be absent.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);
  const [filter, setFilter] = useState("Tout");
  const [previewOpen, setPreviewOpen] = useState(false);

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

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setName(data?.name ?? null);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Nothing is shown until the session is confirmed, so a signed-out visitor
  // never sees the dashboard before being redirected.
  if (!session) {
    return <div className="min-h-screen bg-[#F5F4F0]" />;
  }

  const visibleCards = cards.filter(
    (card) => filter === "Tout" || card.category === filter,
  );

  return (
    <div className="flex h-screen flex-col bg-[#F5F4F0] font-sans text-[#1C1B2E] antialiased">
      <Navbar />

      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[58px] shrink-0 flex-col items-center border-r border-[#E8E8E8] bg-white py-4">
          <div className="flex flex-1 flex-col items-center justify-center gap-2">
            {sidebarIcons.map((item) => {
              const isActive = item.filter === filter;
              return (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => item.filter && setFilter(item.filter)}
                  aria-label={item.label}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex h-10 w-10 items-center justify-center rounded-[10px] transition-colors ${
                    isActive
                      ? "bg-[#F5F4F0] text-[#2A3560]"
                      : "text-[#888780] hover:text-[#2A3560]"
                  }`}
                >
                  <Icon name={item.name} />
                </button>
              );
            })}
          </div>
          <span
            title={name ?? session.user.email}
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2A3560] text-[11px] font-medium text-white"
          >
            {getInitials(name, session.user.email)}
          </span>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[640px] px-5 py-6">
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`rounded-full border px-3.5 py-1.5 text-[12px] transition-colors ${
                    filter === item
                      ? "border-[#2A3560] bg-[#2A3560] text-white"
                      : "border-[#E8E8E8] bg-white text-[#888780] hover:border-[#2A3560] hover:text-[#2A3560]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-5 flex flex-col gap-4">
              {/* Hidden rather than unmounted, so likes and playback survive a filter change. */}
              {cards.map((card) => (
                <div key={card.category} hidden={!visibleCards.includes(card)}>
                  {card.content}
                </div>
              ))}
              {visibleCards.length === 0 && (
                <p className="rounded-[10px] border border-dashed border-[#E8E8E8] px-5 py-10 text-center text-[13px] text-[#888780]">
                  Rien dans « {filter} » pour l&apos;instant.
                </p>
              )}
            </div>
          </div>
        </main>

        <aside className="hidden w-[240px] shrink-0 overflow-y-auto border-l border-[#E8E8E8] bg-white p-5 lg:block">
          <SidebarTitle>Mes espaces</SidebarTitle>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {spaces.map((space) => (
              <button
                key={space.label}
                type="button"
                onClick={() => space.filter && setFilter(space.filter)}
                className={`flex flex-col items-start gap-2 rounded-[10px] border p-3 text-left transition-colors hover:border-[#2A3560] ${space.bg} ${
                  space.filter === filter ? "border-[#2A3560]" : "border-transparent"
                }`}
              >
                <Icon name={space.name} className={`h-4 w-4 ${space.color}`} />
                <span className="text-[12px] font-medium text-[#1C1B2E]">
                  {space.label}
                </span>
              </button>
            ))}
          </div>

          <div className="mt-7">
            <SidebarTitle>Abonnements</SidebarTitle>
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            {following.map((person) => (
              <li key={person.name} className="flex items-center gap-2.5">
                <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-medium text-white ${person.color}`}>
                  {person.name[0]}
                </span>
                <p className="min-w-0 flex-1 truncate text-[12px] font-medium text-[#1C1B2E]">
                  {person.name}
                </p>
                <span className="rounded-full bg-[#F5F4F0] px-2 py-0.5 text-[10px] text-[#888780]">
                  {person.tag}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-7">
            <SidebarTitle>Tendances</SidebarTitle>
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            {trends.map((trend, index) => (
              <li key={trend.topic} className="flex gap-2.5">
                <span className="font-serif text-[13px] text-[#C4A94A]">
                  {index + 1}
                </span>
                <div>
                  <p className="text-[12px] font-medium text-[#1C1B2E]">
                    {trend.topic}
                  </p>
                  <p className="text-[11px] text-[#888780]">{trend.count}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-7 rounded-[10px] bg-[#EEF0F8] p-4">
            <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#2A3560]">
              Ta newsletter · demain
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {newsletterTags.map((tag) => (
                <span key={tag} className="rounded-full bg-white px-2 py-0.5 text-[10px] text-[#2A3560]">
                  {tag}
                </span>
              ))}
            </div>
            {previewOpen && (
              <p className="mt-3 text-[11px] leading-relaxed text-[#888780]">
                Au sommaire : Taïwan et la grammaire de la tension, Satie en
                trois morceaux, et où tu en es dans Sapiens.
              </p>
            )}
            <button
              type="button"
              onClick={() => setPreviewOpen(!previewOpen)}
              aria-expanded={previewOpen}
              className="mt-3 w-full rounded-md bg-[#2A3560] px-3 py-2 text-[12px] font-medium text-white transition-colors hover:bg-[#3D4F8C]"
            >
              {previewOpen ? "Masquer" : "Prévisualiser"}
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}

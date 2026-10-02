"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import Navbar, { getInitials } from "@/components/Navbar";
import { avatarTones, contacts, notifications, trends } from "@/lib/sample-data";
import { supabase } from "@/lib/supabase";

const CREAM = "#F7F4EE";
const SURFACE = "#F0EBE1";
const INDIGO = "#2A3560";
const GOLD = "#C4A94A";
const TEXT = "#1C1A15";
const WHITE = "#FFFFFF";
const GEORGIA = "Georgia, 'Times New Roman', serif";

const ink = (alpha: number) => `rgba(28,26,21,${alpha})`;
const black = (alpha: number) => `rgba(0,0,0,${alpha})`;
const DIM = ink(0.4);

// Hover states can't be expressed as inline styles; an inline background would
// also override them, so hoverable elements get their base colour here too.
const css = `
.pf-hover:hover { background: ${black(0.04)}; }
.pf-action:hover { background: ${black(0.05)}; }
.pf-soft { background: ${SURFACE}; transition: background-color 0.15s; }
.pf-soft:hover { background: #EAE3D6; }
.pf-tab { color: ${DIM}; border-bottom: 2px solid transparent; }
.pf-tab:hover { color: ${TEXT}; }
.pf-noscrollbar { scrollbar-width: none; }
.pf-noscrollbar::-webkit-scrollbar { display: none; }
`;

type Profile = {
  username: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  interests: string[] | null;
};

type Post = {
  id: string;
  type: string;
  content: string;
  url: string | null;
  category: string | null;
  likes_count: number | null;
  created_at: string;
};

type Book = {
  id: string;
  title: string;
  author: string | null;
  status: "en_cours" | "lu" | "liste" | null;
  page_current: number | null;
  page_total: number | null;
};

type GameScore = {
  id: string;
  game_type: string;
  score: number;
  streak: number | null;
  played_at: string;
};

const tabs = ["Partages", "Musique", "Livres", "Jeux", "Sauvegardés"];

// Shown while the matching profile fields are still empty in Supabase.
const FALLBACK_LOCATION = "Paris";
const FALLBACK_BIO =
  "Salle des marchés · BNP Paribas. Curieux de géopolitique, d'histoire et de tout ce qui dépasse.";
const FALLBACK_INTERESTS = [
  "Géopolitique",
  "Histoire",
  "Philosophie",
  "Science",
  "Musique",
  "Littérature",
  "Art",
  "Économie",
];

const stats = [
  { value: "312", label: "interactions", color: TEXT },
  { value: "48", label: "abonnés", color: TEXT },
  { value: "21", label: "abonnements", color: TEXT },
  { value: "7j", label: "de suite", color: GOLD },
];

const spineColors = ["#EEEDFE", "#E1F5EE", "#FAEEDA"];

const sampleBooks = [
  { id: "sapiens", title: "Sapiens", author: "Y.N. Harari", status: "p.214 · 48%" },
  { id: "arendt", title: "La condition humaine", author: "H. Arendt", status: "terminé" },
  { id: "meditations", title: "Méditations", author: "Marc Aurèle", status: "liste" },
];

const tracks = [
  { title: "Nespole", artist: "Floating Points", color: "#EEEDFE" },
  { title: "Untitled 7", artist: "Burial", color: "#E1F5EE" },
  { title: "Kind of Blue", artist: "Miles Davis", color: "#FAEEDA" },
];

const categoryTones: Record<string, { background: string; color: string }> = {
  Géopolitique: { background: "rgba(29,158,117,0.1)", color: "#0F6E56" },
  Science: { background: "rgba(29,158,117,0.1)", color: "#0F6E56" },
  Histoire: { background: "rgba(196,169,74,0.12)", color: "#8B6914" },
  Musique: { background: "rgba(131,77,255,0.08)", color: "#6B3FD4" },
  Littérature: { background: "rgba(59,109,17,0.08)", color: "#3B6D11" },
  Art: { background: "rgba(153,53,86,0.08)", color: "#993556" },
};
const DEFAULT_TONE = { background: "rgba(83,74,183,0.08)", color: "#534AB7" };

const samplePosts = [
  {
    id: "taiwan",
    category: "Géopolitique",
    when: "il y a 2h",
    title: "Détroit de Taïwan : une nouvelle grammaire de la tension",
    source: "Le Monde · 5 min",
    quote: null,
    likes: 47,
    comments: 12,
  },
  {
    id: "nietzsche",
    category: "Philosophie",
    when: "hier",
    title: "Nietzsche et la volonté de puissance — retour aux sources",
    source: null,
    quote: "On ne voit bien qu'avec le cœur — mais le cœur aussi a ses angles morts.",
    likes: 88,
    comments: 24,
  },
];

const quizHistory = [
  { question: "Quel philosophe a théorisé la volonté de puissance ?", answer: "Nietzsche" },
  { question: "Premier empire à utiliser la route de la soie ?", answer: "Han" },
  { question: "Quel pays a inventé le billet de banque ?", answer: "Chine" },
  { question: "Capitale de l'empire byzantin jusqu'en 1453 ?", answer: "Constantinople" },
];

const similarProfiles = [
  { initials: "NL", name: "Nicolas L.", tags: "Histoire · Philo · Géopo", ...avatarTones[5] },
  { initials: "AV", name: "Amira V.", tags: "Science · Tech · Podcast", ...avatarTones[0] },
  { initials: "PG", name: "Paul G.", tags: "Géopo · Art · Cinéma", ...avatarTones[2] },
  { initials: "CM", name: "Clara M.", tags: "Science · Histoire", ...avatarTones[4] },
];

const gameNames: Record<string, string> = {
  "mot-fantome": "Mot Fantôme",
  geoblitz: "GéoBlitz",
};

const card: CSSProperties = {
  background: WHITE,
  border: `1px solid ${black(0.07)}`,
  borderRadius: 14,
  padding: 16,
};

function timeAgo(date: string) {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "hier";
  if (days < 30) return `il y a ${days} j`;
  return `le ${new Date(date).toLocaleDateString("fr-FR", { day: "numeric", month: "short", year: "numeric" })}`;
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

function bookStatus(book: Book) {
  if (book.status === "lu") return "terminé";
  if (book.status === "liste" || !book.status) return "liste";
  const page = book.page_current ?? 0;
  if (!book.page_total) return `p.${page}`;
  return `p.${page} · ${Math.round((page / book.page_total) * 100)}%`;
}

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

function Actions({ likes, comments }: { likes: number; comments: number }) {
  const [active, setActive] = useState({ like: false, comment: false, save: false });
  const button = (key: keyof typeof active, label: string, content: ReactNode, activeStyle: CSSProperties, className = "") => (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active[key]}
      onClick={() => setActive({ ...active, [key]: !active[key] })}
      className={`flex items-center ${active[key] ? "" : "pf-action"} ${className}`}
      style={{ padding: "5px 10px", borderRadius: 8, fontSize: 12, gap: 5, ...(active[key] ? activeStyle : { color: ink(0.55) }) }}
    >
      {content}
    </button>
  );
  const indigoActive = { color: INDIGO, background: "rgba(42,53,96,0.07)" };

  return (
    <div className="mt-3 flex" style={{ gap: 4 }}>
      {button("like", "Aimer", <>♥ {likes + (active.like ? 1 : 0)}</>, { color: "#D4537E", background: "rgba(212,83,126,0.06)" })}
      {button("comment", "Commenter", <>💬 {comments}</>, indigoActive)}
      {button("save", "Sauvegarder", "🔖", indigoActive, "ml-auto")}
    </div>
  );
}

function PostHeader({ category, when }: { category: string | null; when: string }) {
  return (
    <div className="flex items-center gap-2">
      {category && (
        <span style={{ ...(categoryTones[category] ?? DEFAULT_TONE), fontSize: 10, borderRadius: 10, padding: "2px 8px" }}>
          {category}
        </span>
      )}
      <span style={{ fontSize: 11, color: DIM }}>Partagé {when}</span>
    </div>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="text-center" style={{ border: `1px dashed ${black(0.12)}`, borderRadius: 14, padding: "40px 20px", fontSize: 13, color: DIM }}>
      {children}
    </p>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  // undefined while the session is still being read, null once known to be absent.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [scores, setScores] = useState<GameScore[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [tab, setTab] = useState("Partages");
  const [followed, setFollowed] = useState<string[]>([]);
  const [activeInterest, setActiveInterest] = useState<string | null>(null);

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

    (async () => {
      const [profileResult, postsResult, booksResult, scoresResult] = await Promise.all([
        supabase.from("profiles").select("username, name, bio, location, interests").eq("id", userId).maybeSingle(),
        supabase.from("posts").select("id, type, content, url, category, likes_count, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
        supabase.from("books").select("id, title, author, status, page_current, page_total").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
        supabase.from("game_scores").select("id, game_type, score, streak, played_at").eq("user_id", userId).order("played_at", { ascending: false }).limit(8),
      ]);
      if (cancelled) return;

      const firstError = [profileResult, postsResult, booksResult, scoresResult].find((result) => result.error)?.error;
      setLoadError(firstError?.message ?? null);
      setProfile(profileResult.data);
      setPosts((postsResult.data as Post[] | null) ?? []);
      setBooks((booksResult.data as Book[] | null) ?? []);
      setScores((scoresResult.data as GameScore[] | null) ?? []);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!session) {
    return <div className="min-h-screen" style={{ background: CREAM }} />;
  }

  const email = session.user.email;
  const displayName = profile?.name ?? email?.split("@")[0] ?? "";
  const username = profile?.username ?? email?.split("@")[0] ?? "";
  const interests = profile?.interests?.length ? profile.interests : FALLBACK_INTERESTS;

  // Real rows replace the samples as soon as there is at least one.
  const bookRows =
    books.length > 0
      ? books.map((book) => ({ id: book.id, title: book.title, author: book.author ?? "", status: bookStatus(book) }))
      : sampleBooks;

  const booksCard = (
    <section style={card}>
      <SectionLabel>En cours de lecture</SectionLabel>
      <ul>
        {bookRows.map((book, index) => (
          <li
            key={book.id}
            className="flex items-center"
            style={{ padding: "8px 0", gap: 10, borderBottom: index < bookRows.length - 1 ? `1px solid ${black(0.05)}` : "none" }}
          >
            <span className="flex shrink-0 items-center justify-center" style={{ width: 28, height: 38, background: spineColors[index % spineColors.length], borderRadius: 3, fontSize: 11 }}>
              📖
            </span>
            <div className="min-w-0">
              <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{book.title}</p>
              <p className="truncate" style={{ fontSize: 11, color: DIM }}>{book.author}</p>
              <p style={{ fontSize: 10, color: book.status === "terminé" ? "#0F6E56" : book.status === "liste" ? DIM : "#8B6914" }}>
                {book.status}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );

  const musicCard = (
    <section style={card}>
      <SectionLabel>Écouté récemment</SectionLabel>
      <ul>
        {tracks.map((track, index) => (
          <li
            key={track.title}
            className="flex items-center"
            style={{ padding: "8px 0", gap: 10, borderBottom: index < tracks.length - 1 ? `1px solid ${black(0.05)}` : "none" }}
          >
            <span className="flex shrink-0 items-center justify-center" style={{ width: 32, height: 32, background: track.color, borderRadius: 7, fontSize: 12 }}>
              🎵
            </span>
            <div className="min-w-0">
              <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{track.title}</p>
              <p className="truncate" style={{ fontSize: 11, color: DIM }}>{track.artist}</p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );

  const postsFeed = (
    <div className="flex flex-col" style={{ gap: 10 }}>
      {posts.length > 0
        ? posts.map((post) => {
            const link = safeUrl(post.url);
            return (
              <article key={post.id} style={card}>
                <PostHeader category={post.category} when={timeAgo(post.created_at)} />
                <p className="mt-3 whitespace-pre-wrap break-words" style={{ fontSize: 14, color: TEXT, lineHeight: 1.6 }}>
                  {post.content}
                </p>
                {link && (
                  <a href={link.href} target="_blank" rel="noopener noreferrer" className="mt-2 block truncate hover:underline" style={{ fontSize: 11, color: INDIGO }}>
                    ↗ {link.hostname.replace(/^www\./, "")}
                    {link.pathname !== "/" && link.pathname}
                  </a>
                )}
                <Actions likes={post.likes_count ?? 0} comments={0} />
              </article>
            );
          })
        : samplePosts.map((post) => (
            <article key={post.id} style={card}>
              <PostHeader category={post.category} when={post.when} />
              <h3 className="mt-3" style={{ fontSize: 15, fontWeight: 500, color: TEXT, lineHeight: 1.4 }}>{post.title}</h3>
              {post.source && (
                <p className="mt-2" style={{ fontSize: 11, color: ink(0.35) }}>{post.source}</p>
              )}
              {post.quote && (
                <p className="mt-3 pl-3" style={{ fontFamily: GEORGIA, fontStyle: "italic", fontSize: 13, color: ink(0.6), lineHeight: 1.7, borderLeft: `2px solid ${GOLD}` }}>
                  {post.quote}
                </p>
              )}
              <Actions likes={post.likes} comments={post.comments} />
            </article>
          ))}
    </div>
  );

  const gamesCard = (
    <section style={card}>
      {scores.length > 0 ? (
        <>
          <SectionLabel>Scores récents</SectionLabel>
          <ul>
            {scores.map((score, index) => (
              <li
                key={score.id}
                className="flex items-center justify-between gap-3"
                style={{ padding: "8px 0", borderBottom: index < scores.length - 1 ? `1px solid ${black(0.05)}` : "none" }}
              >
                <div className="min-w-0">
                  <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>
                    {gameNames[score.game_type] ?? score.game_type}
                  </p>
                  <p style={{ fontSize: 10, color: DIM }}>
                    Joué {timeAgo(score.played_at)}
                    {score.streak ? ` · série ${score.streak}j` : ""}
                  </p>
                </div>
                <span style={{ fontFamily: GEORGIA, fontSize: 16, color: GOLD }}>{score.score}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <>
          <SectionLabel>Quiz récents</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2">
            {quizHistory.map((quiz, index) => (
              <div
                key={quiz.question}
                style={{
                  padding: 10,
                  borderTop: index >= 2 ? `1px solid ${black(0.05)}` : "none",
                  borderLeft: index % 2 === 1 ? `1px solid ${black(0.05)}` : "none",
                }}
              >
                <p style={{ fontSize: 11, fontWeight: 500, color: TEXT, lineHeight: 1.35 }}>{quiz.question}</p>
                <span className="mt-2 inline-block" style={{ fontSize: 10, background: "#EEEDFE", color: "#534AB7", borderRadius: 6, padding: "2px 7px" }}>
                  {quiz.answer}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );

  return (
    <div className="flex h-screen flex-col" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <style>{css}</style>
      <Navbar />

      <div className="grid min-h-0 flex-1 grid-cols-1 overflow-hidden md:grid-cols-[220px_1fr_260px]">
        {/* Left column */}
        <aside className="hidden overflow-y-auto md:block" style={{ background: WHITE, borderRight: `1px solid ${black(0.07)}`, padding: "24px 16px" }}>
          <div className="flex flex-col items-center text-center">
            <span className="flex items-center justify-center" style={{ width: 64, height: 64, background: INDIGO, color: CREAM, borderRadius: "50%", fontFamily: GEORGIA, fontSize: 22 }}>
              {getInitials(profile?.name ?? null, email)}
            </span>
            <h1 className="mt-3 break-words" style={{ fontFamily: GEORGIA, fontSize: 16, fontWeight: 500, color: TEXT }}>
              {displayName}
            </h1>
            <p className="mt-1 break-words" style={{ fontSize: 12, color: DIM }}>
              @{username} · {profile?.location ?? FALLBACK_LOCATION}
            </p>
            <p className="mt-3" style={{ fontSize: 12, color: ink(0.55), lineHeight: 1.6 }}>
              {profile?.bio ?? FALLBACK_BIO}
            </p>
          </div>
          <button type="button" className="pf-hover mt-3 w-full" style={{ border: `1px solid ${black(0.1)}`, borderRadius: 10, fontSize: 12, padding: 7, color: TEXT }}>
            Modifier le profil
          </button>
          <button type="button" className="pf-soft mt-2 w-full" style={{ borderRadius: 10, fontSize: 12, padding: 7, color: TEXT }}>
            Message
          </button>

          <Divider />

          <div className="grid grid-cols-2" style={{ gap: 8 }}>
            {stats.map((stat) => (
              <div key={stat.label} className="text-center" style={{ background: CREAM, borderRadius: 10, padding: 10 }}>
                <p style={{ fontFamily: GEORGIA, fontSize: 20, lineHeight: 1.1, color: stat.color }}>{stat.value}</p>
                <p className="mt-1" style={{ fontSize: 10, color: DIM }}>{stat.label}</p>
              </div>
            ))}
          </div>

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
        </aside>

        {/* Centre column */}
        <main className="min-w-0 overflow-y-auto" style={{ background: CREAM, padding: "0 20px 40px" }}>
          <div className="sticky top-0 z-10 mb-4" style={{ background: CREAM, paddingTop: 20, borderBottom: `1px solid ${black(0.06)}` }}>
            <div className="pf-noscrollbar flex overflow-x-auto">
              {tabs.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  aria-current={tab === item ? "page" : undefined}
                  className={`-mb-px shrink-0 ${tab === item ? "" : "pf-tab"}`}
                  style={{
                    fontSize: 13,
                    padding: "8px 16px 12px",
                    ...(tab === item ? { borderBottom: `2px solid ${INDIGO}`, color: TEXT, fontWeight: 500 } : {}),
                  }}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {loadError && (
            <p role="alert" className="mb-4" style={{ ...card, fontSize: 12, color: "#C0392B" }}>
              Certaines données n&apos;ont pas pu être chargées : {loadError}
            </p>
          )}

          {tab === "Partages" && (
            <>
              <div className="mb-4 grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
                {booksCard}
                {musicCard}
              </div>
              {postsFeed}
              <div style={{ marginTop: 10 }}>{gamesCard}</div>
            </>
          )}
          {tab === "Musique" && musicCard}
          {tab === "Livres" && booksCard}
          {tab === "Jeux" && gamesCard}
          {tab === "Sauvegardés" && <Empty>Rien de sauvegardé pour l&apos;instant.</Empty>}
        </main>

        {/* Right column */}
        <aside className="hidden overflow-y-auto md:block" style={{ background: WHITE, borderLeft: `1px solid ${black(0.07)}`, padding: "20px 16px" }}>
          <SectionLabel>Profils similaires</SectionLabel>
          <ul className="flex flex-col" style={{ gap: 8 }}>
            {similarProfiles.map((person) => {
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
                    className={`ml-auto shrink-0 ${isFollowed ? "" : "pf-hover"}`}
                    style={{
                      border: `1px solid ${isFollowed ? INDIGO : black(0.1)}`,
                      borderRadius: 10,
                      fontSize: 10,
                      padding: "3px 10px",
                      ...(isFollowed ? { background: INDIGO, color: CREAM } : { color: ink(0.6) }),
                    }}
                  >
                    {isFollowed ? "Suivi" : "Suivre"}
                  </button>
                </li>
              );
            })}
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

          <SectionLabel>Centres d&apos;intérêt</SectionLabel>
          <div className="flex flex-wrap" style={{ gap: 5 }}>
            {interests.map((interest) => {
              const isActive = activeInterest === interest;
              return (
                <button
                  key={interest}
                  type="button"
                  aria-pressed={isActive}
                  onClick={() => setActiveInterest(isActive ? null : interest)}
                  className={isActive ? "" : "pf-soft"}
                  style={{
                    borderRadius: 20,
                    fontSize: 11,
                    padding: "4px 12px",
                    ...(isActive ? { background: INDIGO, color: CREAM } : { color: ink(0.6) }),
                  }}
                >
                  {interest}
                </button>
              );
            })}
          </div>
        </aside>
      </div>
    </div>
  );
}

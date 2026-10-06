"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import Navbar, { getInitials } from "@/components/Navbar";
import SharedMusicCard from "@/components/MusicCard";
import { fetchRecentTracks, playedAgo, type LastfmTrack } from "@/lib/lastfm";
import { fetchEmbed, parseEmbed, type MusicEmbed } from "@/lib/music";
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
  /** Music link details; only once the metadata column exists. */
  metadata?: unknown;
};

type Book = {
  id: string;
  title: string;
  author: string | null;
  status: "en_cours" | "lu" | "liste" | null;
  page_current: number | null;
  page_total: number | null;
};

const tabs = ["Partages", "Musique", "Livres", "Sauvegardés"];

const spineColors = ["#EEEDFE", "#E1F5EE", "#FAEEDA"];
const trackColors = ["#EEEDFE", "#E1F5EE", "#FAEEDA"];

const categoryTones: Record<string, { background: string; color: string }> = {
  Géopolitique: { background: "rgba(29,158,117,0.1)", color: "#0F6E56" },
  Science: { background: "rgba(29,158,117,0.1)", color: "#0F6E56" },
  Histoire: { background: "rgba(196,169,74,0.12)", color: "#8B6914" },
  Musique: { background: "rgba(131,77,255,0.08)", color: "#6B3FD4" },
  Littérature: { background: "rgba(59,109,17,0.08)", color: "#3B6D11" },
  Art: { background: "rgba(153,53,86,0.08)", color: "#993556" },
};
const DEFAULT_TONE = { background: "rgba(83,74,183,0.08)", color: "#534AB7" };

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

/** A shared music post as a compact card; looks the link up again when no metadata was saved. */
function MusicShare({ post }: { post: Post }) {
  const [embed, setEmbed] = useState<MusicEmbed | null>(() => parseEmbed(post.metadata));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (embed || !post.url) return;
    let cancelled = false;
    fetchEmbed(post.url)
      .then((result) => {
        if (!cancelled) setEmbed(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [embed, post.url]);

  if (embed) return <SharedMusicCard embed={embed} href={post.url} compact />;
  if (failed || !post.url) return null;
  return <div aria-hidden className="animate-pulse" style={{ height: 54, background: black(0.05), borderRadius: 12 }} />;
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
  const [loadError, setLoadError] = useState<string | null>(null);
  // Latest Last.fm tracks; null while loading or when no account is linked.
  const [recentTracks, setRecentTracks] = useState<LastfmTrack[] | null>(null);
  const [tab, setTab] = useState("Partages");
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
      const [profileResult, postsResult, booksResult] = await Promise.all([
        supabase.from("profiles").select("username, name, bio, location, interests").eq("id", userId).maybeSingle(),
        supabase
          .from("posts")
          .select("*")
          .eq("user_id", userId)
          // Leftovers from testing the Apple Shortcut, as in the feed.
          .not("content", "ilike", "%Morceau actuel%")
          .not("content", "ilike", "%Test du Raccourci%")
          .order("created_at", { ascending: false })
          .limit(20),
        supabase.from("books").select("id, title, author, status, page_current, page_total").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      ]);
      if (cancelled) return;

      const firstError = [profileResult, postsResult, booksResult].find((result) => result.error)?.error;
      setLoadError(firstError?.message ?? null);
      setProfile(profileResult.data);
      setPosts((postsResult.data as Post[] | null) ?? []);
      setBooks((booksResult.data as Book[] | null) ?? []);

      // Read on its own: the column only exists once the migration has run.
      const { data: music } = await supabase.from("profiles").select("lastfm_username").eq("id", userId).maybeSingle();
      if (music?.lastfm_username) {
        try {
          const tracks = await fetchRecentTracks(music.lastfm_username, 3);
          if (!cancelled && tracks.length > 0) setRecentTracks(tracks);
        } catch {
          // Last.fm unreachable: keep empty state.
        }
      }
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
  const interests = profile?.interests ?? [];

  // Compute real stats from loaded data.
  const computedStats = [
    { value: String(posts.length), label: "partages", color: TEXT },
    { value: "0", label: "abonnés", color: TEXT },
    { value: "0", label: "abonnements", color: TEXT },
    { value: String(books.length), label: "livres", color: GOLD },
  ];

  const bookRows = books.map((book) => ({
    id: book.id,
    title: book.title,
    author: book.author ?? "",
    status: bookStatus(book),
  }));

  const booksCard =
    bookRows.length > 0 ? (
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
    ) : (
      <section style={card}>
        <SectionLabel>En cours de lecture</SectionLabel>
        <p style={{ fontSize: 12, color: DIM, lineHeight: 1.6 }}>
          Aucun livre ajouté pour le moment.
        </p>
      </section>
    );

  const musicPosts = posts.filter((post) => post.type === "musique");

  const trackRows = recentTracks
    ? recentTracks.slice(0, 3).map((track, index) => ({
        key: `${track.name}-${index}`,
        title: track.name,
        artist: track.nowPlaying ? `${track.artist} · en ce moment` : `${track.artist} · ${playedAgo(track)}`,
        color: trackColors[index % trackColors.length],
        nowPlaying: track.nowPlaying,
      }))
    : [];

  const musicCard =
    trackRows.length > 0 ? (
      <section style={card}>
        <SectionLabel>Écouté récemment · Last.fm</SectionLabel>
        <ul>
          {trackRows.map((track, index) => (
            <li
              key={track.key}
              className="flex items-center"
              style={{ padding: "8px 0", gap: 10, borderBottom: index < trackRows.length - 1 ? `1px solid ${black(0.05)}` : "none" }}
            >
              <span className="flex shrink-0 items-center justify-center" style={{ width: 32, height: 32, background: track.color, borderRadius: 7, fontSize: 12 }}>
                {track.nowPlaying ? "🔊" : "🎵"}
              </span>
              <div className="min-w-0">
                <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{track.title}</p>
                <p className="truncate" style={{ fontSize: 11, color: DIM }}>{track.artist}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    ) : (
      <section style={card}>
        <SectionLabel>Écouté récemment</SectionLabel>
        <p style={{ fontSize: 12, color: DIM, lineHeight: 1.6 }}>
          Connecte ton compte Last.fm dans les paramètres pour afficher ta musique ici.
        </p>
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
        : <Empty>Tu n&apos;as pas encore partagé de contenu — partage depuis ton dashboard.</Empty>}
    </div>
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
              @{username}{profile?.location ? ` · ${profile.location}` : ""}
            </p>
            {profile?.bio && (
              <p className="mt-3" style={{ fontSize: 12, color: ink(0.55), lineHeight: 1.6 }}>
                {profile.bio}
              </p>
            )}
          </div>
          <button type="button" className="pf-hover mt-3 w-full" style={{ border: `1px solid ${black(0.1)}`, borderRadius: 10, fontSize: 12, padding: 7, color: TEXT }}>
            Modifier le profil
          </button>

          <Divider />

          <div className="grid grid-cols-2" style={{ gap: 8 }}>
            {computedStats.map((stat) => (
              <div key={stat.label} className="text-center" style={{ background: CREAM, borderRadius: 10, padding: 10 }}>
                <p style={{ fontFamily: GEORGIA, fontSize: 20, lineHeight: 1.1, color: stat.color }}>{stat.value}</p>
                <p className="mt-1" style={{ fontSize: 10, color: DIM }}>{stat.label}</p>
              </div>
            ))}
          </div>

          <Divider />

          <SectionLabel>Abonnements</SectionLabel>
          <p style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>
            Tes abonnements apparaîtront ici quand tu suivras des profils.
          </p>
        </aside>

        {/* Centre column */}
        <main className="min-w-0 overflow-y-auto px-3 md:px-5" style={{ background: CREAM, paddingBottom: 40 }}>
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
            </>
          )}
          {tab === "Musique" &&
            (musicPosts.length === 0 ? (
              <Empty>Tu n&apos;as pas encore partagé de musique — colle un lien depuis ton dashboard</Empty>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
                {musicPosts.map((post) => (
                  <MusicShare key={post.id} post={post} />
                ))}
              </div>
            ))}
          {tab === "Livres" && booksCard}
          {tab === "Sauvegardés" && <Empty>Rien de sauvegardé pour l&apos;instant.</Empty>}
        </main>

        {/* Right column */}
        <aside className="hidden overflow-y-auto md:block" style={{ background: WHITE, borderLeft: `1px solid ${black(0.07)}`, padding: "20px 16px" }}>
          <SectionLabel>Tendances</SectionLabel>
          <p style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>
            Les sujets populaires dans ton réseau s&apos;afficheront ici.
          </p>

          <Divider />

          <SectionLabel>Notifications</SectionLabel>
          <p style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>
            Aucune notification pour le moment.
          </p>

          {interests.length > 0 && (
            <>
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
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

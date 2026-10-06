"use client";

import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import Navbar, { getInitials } from "@/components/Navbar";
import SharedMusicCard from "@/components/MusicCard";
import { fetchRecentTracks, playedAgo, type LastfmTrack } from "@/lib/lastfm";
import { fetchEmbed, parseEmbed, type MusicEmbed } from "@/lib/music";
import { avatarTones } from "@/lib/sample-data";
import { follow, getFollowers, getFollowing, isFollowing as checkFollowing, unfollow, type PublicProfile } from "@/lib/social";
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
  interests: string[];
  followers_count: number;
  following_count: number;
};

type Post = {
  id: string;
  type: string;
  content: string;
  url: string | null;
  category: string | null;
  likes_count: number | null;
  created_at: string;
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

const tabs = ["Partages", "Musique", "Livres", "Abonnés", "Abonnements"];

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

function MusicShare({ post }: { post: Post }) {
  const [embed, setEmbed] = useState<MusicEmbed | null>(() => parseEmbed(post.metadata));
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (embed || !post.url) return;
    let cancelled = false;
    fetchEmbed(post.url)
      .then((result) => { if (!cancelled) setEmbed(result); })
      .catch(() => { if (!cancelled) setFailed(true); });
    return () => { cancelled = true; };
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

function FollowButton({ viewerId, targetId, initialFollowing }: { viewerId: string; targetId: string; initialFollowing: boolean }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    const next = !following;
    setFollowing(next);
    const ok = next ? await follow(viewerId, targetId) : await unfollow(viewerId, targetId);
    if (!ok) setFollowing(!next);
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      className="w-full transition disabled:opacity-50"
      style={{
        fontSize: 13,
        fontWeight: 500,
        padding: "9px 20px",
        borderRadius: 20,
        ...(following
          ? { background: "transparent", border: `1px solid ${black(0.15)}`, color: ink(0.6) }
          : { background: INDIGO, color: CREAM, border: `1px solid ${INDIGO}` }),
      }}
    >
      {following ? "Suivi ✓" : "Suivre"}
    </button>
  );
}

function ProfileListItem({ profile }: { profile: PublicProfile }) {
  const tone = avatarTones[(profile.id.charCodeAt(0) + profile.id.charCodeAt(1)) % avatarTones.length];
  return (
    <li>
      <Link href={`/profile?id=${profile.id}`} className="pf-hover flex items-center gap-3" style={{ padding: "10px 0", borderRadius: 10 }}>
        <span className="flex shrink-0 items-center justify-center" style={{ width: 36, height: 36, borderRadius: "50%", fontSize: 13, fontWeight: 500, ...tone }}>
          {getInitials(profile.name, profile.username)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{profile.name ?? profile.username}</p>
          <p className="truncate" style={{ fontSize: 11, color: DIM }}>@{profile.username}</p>
        </div>
        <span style={{ fontSize: 11, color: DIM }}>{profile.followers_count} abonnés</span>
      </Link>
    </li>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const targetId = searchParams.get("id");

  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [books, setBooks] = useState<Book[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recentTracks, setRecentTracks] = useState<LastfmTrack[] | null>(null);
  const [tab, setTab] = useState("Partages");
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [followers, setFollowers] = useState<PublicProfile[] | null>(null);
  const [following, setFollowing] = useState<PublicProfile[] | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setSession(data.session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => subscription.unsubscribe();
  }, [router]);

  const viewerId = session?.user.id;
  // Show the viewer's own profile when no ?id= is given, or when ?id= is their own.
  const profileUserId = targetId && targetId !== viewerId ? targetId : viewerId;
  const isOwnProfile = profileUserId === viewerId;

  useEffect(() => {
    if (!profileUserId) return;
    let cancelled = false;

    (async () => {
      const [profileResult, postsResult, booksResult] = await Promise.all([
        supabase.from("profiles").select("username, name, bio, location, interests, followers_count, following_count").eq("id", profileUserId).maybeSingle(),
        supabase.from("posts").select("*").eq("user_id", profileUserId)
          .not("content", "ilike", "%Morceau actuel%")
          .not("content", "ilike", "%Test du Raccourci%")
          .order("created_at", { ascending: false }).limit(20),
        supabase.from("books").select("id, title, author, status, page_current, page_total").eq("user_id", profileUserId).order("created_at", { ascending: false }).limit(10),
      ]);
      if (cancelled) return;

      const firstError = [profileResult, postsResult, booksResult].find((r) => r.error)?.error;
      setLoadError(firstError?.message ?? null);
      const p = profileResult.data;
      setProfile(p ? { ...p, interests: Array.isArray(p.interests) ? p.interests : [], followers_count: p.followers_count ?? 0, following_count: p.following_count ?? 0 } : null);
      setPosts((postsResult.data as Post[] | null) ?? []);
      setBooks((booksResult.data as Book[] | null) ?? []);

      // Check follow status
      if (viewerId && !isOwnProfile) {
        const f = await checkFollowing(viewerId, profileUserId);
        if (!cancelled) setIsFollowingUser(f);
      }

      // Last.fm
      const { data: music } = await supabase.from("profiles").select("lastfm_username").eq("id", profileUserId).maybeSingle();
      if (music?.lastfm_username) {
        try {
          const tracks = await fetchRecentTracks(music.lastfm_username, 3);
          if (!cancelled && tracks.length > 0) setRecentTracks(tracks);
        } catch {}
      }
    })();

    return () => { cancelled = true; };
  }, [profileUserId, viewerId, isOwnProfile]);

  // Load followers/following when those tabs are clicked
  useEffect(() => {
    if (!profileUserId) return;
    if (tab === "Abonnés" && followers === null) {
      getFollowers(profileUserId).then(setFollowers);
    }
    if (tab === "Abonnements" && following === null) {
      getFollowing(profileUserId).then(setFollowing);
    }
  }, [tab, profileUserId, followers, following]);

  if (!session) return <div className="min-h-screen" style={{ background: CREAM }} />;

  const email = session.user.email;
  const displayName = profile?.name ?? (isOwnProfile ? email?.split("@")[0] : "") ?? "";
  const username = profile?.username ?? (isOwnProfile ? email?.split("@")[0] : "") ?? "";
  const interests = profile?.interests ?? [];
  const initials = getInitials(isOwnProfile ? (profile?.name ?? null) : (profile?.name ?? null), isOwnProfile ? email : profile?.username);

  const computedStats = [
    { value: String(posts.length), label: "partages", color: TEXT },
    { value: String(profile?.followers_count ?? 0), label: "abonnés", color: TEXT },
    { value: String(profile?.following_count ?? 0), label: "abonnements", color: TEXT },
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
            <li key={book.id} className="flex items-center" style={{ padding: "8px 0", gap: 10, borderBottom: index < bookRows.length - 1 ? `1px solid ${black(0.05)}` : "none" }}>
              <span className="flex shrink-0 items-center justify-center" style={{ width: 28, height: 38, background: spineColors[index % spineColors.length], borderRadius: 3, fontSize: 11 }}>📖</span>
              <div className="min-w-0">
                <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{book.title}</p>
                <p className="truncate" style={{ fontSize: 11, color: DIM }}>{book.author}</p>
                <p style={{ fontSize: 10, color: book.status === "terminé" ? "#0F6E56" : book.status === "liste" ? DIM : "#8B6914" }}>{book.status}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    ) : (
      <section style={card}>
        <SectionLabel>En cours de lecture</SectionLabel>
        <p style={{ fontSize: 12, color: DIM, lineHeight: 1.6 }}>
          {isOwnProfile ? "Aucun livre ajouté pour le moment." : "Aucun livre partagé."}
        </p>
      </section>
    );

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
            <li key={track.key} className="flex items-center" style={{ padding: "8px 0", gap: 10, borderBottom: index < trackRows.length - 1 ? `1px solid ${black(0.05)}` : "none" }}>
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
          {isOwnProfile ? "Connecte ton compte Last.fm dans les paramètres pour afficher ta musique ici." : "Pas de musique récente."}
        </p>
      </section>
    );

  const musicPosts = posts.filter((post) => post.type === "musique");

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
                    ↗ {link.hostname.replace(/^www\./, "")}{link.pathname !== "/" && link.pathname}
                  </a>
                )}
                <Actions likes={post.likes_count ?? 0} comments={0} />
              </article>
            );
          })
        : <Empty>{isOwnProfile ? "Tu n'as pas encore partagé de contenu." : "Aucun partage pour le moment."}</Empty>}
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
              {initials}
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

          {isOwnProfile ? (
            <Link href="/settings" className="pf-hover mt-3 block w-full text-center" style={{ border: `1px solid ${black(0.1)}`, borderRadius: 10, fontSize: 12, padding: 7, color: TEXT }}>
              Modifier le profil
            </Link>
          ) : viewerId ? (
            <div className="mt-3">
              <FollowButton viewerId={viewerId} targetId={profileUserId!} initialFollowing={isFollowingUser} />
            </div>
          ) : null}

          <Divider />

          <div className="grid grid-cols-2" style={{ gap: 8 }}>
            {computedStats.map((stat) => (
              <button
                key={stat.label}
                type="button"
                onClick={() => {
                  if (stat.label === "abonnés") setTab("Abonnés");
                  else if (stat.label === "abonnements") setTab("Abonnements");
                }}
                className={stat.label === "abonnés" || stat.label === "abonnements" ? "pf-hover" : ""}
                style={{ background: CREAM, borderRadius: 10, padding: 10, textAlign: "center" }}
              >
                <p style={{ fontFamily: GEORGIA, fontSize: 20, lineHeight: 1.1, color: stat.color }}>{stat.value}</p>
                <p className="mt-1" style={{ fontSize: 10, color: DIM }}>{stat.label}</p>
              </button>
            ))}
          </div>

          {interests.length > 0 && (
            <>
              <Divider />
              <SectionLabel>Centres d&apos;intérêt</SectionLabel>
              <div className="flex flex-wrap" style={{ gap: 5 }}>
                {interests.map((interest) => (
                  <span key={interest} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, background: "rgba(42,53,96,0.07)", color: INDIGO }}>
                    {interest}
                  </span>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* Centre column */}
        <main className="min-w-0 overflow-y-auto px-3 md:px-5" style={{ background: CREAM, paddingBottom: 40 }}>
          {/* Mobile profile header */}
          <div className="mt-5 mb-4 flex items-center gap-3 md:hidden">
            <span className="flex shrink-0 items-center justify-center" style={{ width: 48, height: 48, background: INDIGO, color: CREAM, borderRadius: "50%", fontFamily: GEORGIA, fontSize: 18 }}>
              {initials}
            </span>
            <div className="min-w-0 flex-1">
              <p style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>{displayName}</p>
              <p style={{ fontSize: 12, color: DIM }}>@{username}</p>
            </div>
            {!isOwnProfile && viewerId && (
              <FollowButton viewerId={viewerId} targetId={profileUserId!} initialFollowing={isFollowingUser} />
            )}
          </div>
          {/* Mobile stats */}
          <div className="mb-4 grid grid-cols-4 md:hidden" style={{ gap: 6 }}>
            {computedStats.map((stat) => (
              <div key={stat.label} className="text-center" style={{ background: WHITE, borderRadius: 10, padding: "8px 4px", border: `1px solid ${black(0.06)}` }}>
                <p style={{ fontSize: 16, fontWeight: 600, color: stat.color }}>{stat.value}</p>
                <p style={{ fontSize: 9, color: DIM }}>{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="sticky top-0 z-10 mb-4" style={{ background: CREAM, paddingTop: 20, borderBottom: `1px solid ${black(0.06)}` }}>
            <div className="pf-noscrollbar flex overflow-x-auto">
              {tabs.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  aria-current={tab === item ? "page" : undefined}
                  className={`-mb-px shrink-0 ${tab === item ? "" : "pf-tab"}`}
                  style={{ fontSize: 13, padding: "8px 16px 12px", ...(tab === item ? { borderBottom: `2px solid ${INDIGO}`, color: TEXT, fontWeight: 500 } : {}) }}
                >
                  {item}
                  {item === "Abonnés" && ` (${profile?.followers_count ?? 0})`}
                  {item === "Abonnements" && ` (${profile?.following_count ?? 0})`}
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
              <Empty>{isOwnProfile ? "Tu n'as pas encore partagé de musique." : "Aucune musique partagée."}</Empty>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 10 }}>
                {musicPosts.map((post) => <MusicShare key={post.id} post={post} />)}
              </div>
            ))}
          {tab === "Livres" && booksCard}
          {tab === "Abonnés" && (
            followers === null ? (
              <div className="flex flex-col" style={{ gap: 8 }}>
                {[0, 1, 2].map((i) => <div key={i} className="animate-pulse" style={{ height: 56, background: black(0.04), borderRadius: 12 }} />)}
              </div>
            ) : followers.length === 0 ? (
              <Empty>{isOwnProfile ? "Personne ne te suit encore." : "Aucun abonné pour le moment."}</Empty>
            ) : (
              <ul className="flex flex-col" style={{ gap: 2 }}>
                {followers.map((p) => <ProfileListItem key={p.id} profile={p} />)}
              </ul>
            )
          )}
          {tab === "Abonnements" && (
            following === null ? (
              <div className="flex flex-col" style={{ gap: 8 }}>
                {[0, 1, 2].map((i) => <div key={i} className="animate-pulse" style={{ height: 56, background: black(0.04), borderRadius: 12 }} />)}
              </div>
            ) : following.length === 0 ? (
              <Empty>
                {isOwnProfile ? (
                  <>Aucun abonnement — <Link href="/explore" style={{ color: INDIGO }}>explore des profils</Link></>
                ) : "Ne suit personne pour le moment."}
              </Empty>
            ) : (
              <ul className="flex flex-col" style={{ gap: 2 }}>
                {following.map((p) => <ProfileListItem key={p.id} profile={p} />)}
              </ul>
            )
          )}
        </main>

        {/* Right column */}
        <aside className="hidden overflow-y-auto md:block" style={{ background: WHITE, borderLeft: `1px solid ${black(0.07)}`, padding: "20px 16px" }}>
          <SectionLabel>Tendances</SectionLabel>
          <p style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>
            Les sujets populaires dans ton réseau s&apos;afficheront ici.
          </p>

          <Divider />

          {isOwnProfile ? (
            <>
              <SectionLabel>Raccourcis</SectionLabel>
              <div className="flex flex-col" style={{ gap: 4 }}>
                <Link href="/explore" className="pf-hover flex items-center" style={{ padding: "8px 10px", borderRadius: 10, fontSize: 12, gap: 8, color: ink(0.6) }}>
                  <span aria-hidden style={{ fontSize: 14 }}>🧭</span> Explorer des profils
                </Link>
                <Link href="/settings" className="pf-hover flex items-center" style={{ padding: "8px 10px", borderRadius: 10, fontSize: 12, gap: 8, color: ink(0.6) }}>
                  <span aria-hidden style={{ fontSize: 14 }}>🔧</span> Paramètres
                </Link>
                <Link href="/dashboard" className="pf-hover flex items-center" style={{ padding: "8px 10px", borderRadius: 10, fontSize: 12, gap: 8, color: ink(0.6) }}>
                  <span aria-hidden style={{ fontSize: 14 }}>🏠</span> Mon dashboard
                </Link>
              </div>
            </>
          ) : (
            <>
              <SectionLabel>À propos</SectionLabel>
              {profile?.bio && <p style={{ fontSize: 12, color: ink(0.55), lineHeight: 1.6 }}>{profile.bio}</p>}
              {interests.length > 0 && (
                <div className="mt-3 flex flex-wrap" style={{ gap: 5 }}>
                  {interests.map((interest) => (
                    <span key={interest} style={{ fontSize: 11, padding: "4px 12px", borderRadius: 20, background: "rgba(42,53,96,0.07)", color: INDIGO }}>
                      {interest}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </aside>
      </div>
    </div>
  );
}

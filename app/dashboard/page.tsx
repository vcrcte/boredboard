"use client";

import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session, User } from "@supabase/supabase-js";
import Navbar, { getInitials } from "@/components/Navbar";
import { ensureProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

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

const POST_SELECT = "*, profiles (id, name, username, avatar_url)";

// Feed filters map to post types; filters without a type have no posts yet.
const filters: { label: string; type?: PostType }[] = [
  { label: "Tout" },
  { label: "Actualités", type: "article" },
  { label: "Musique", type: "musique" },
  { label: "Livres", type: "livre" },
  { label: "Podcasts" },
  { label: "Découvertes", type: "reflexion" },
];

const typeLabels: Record<PostType, string> = {
  article: "partage un article",
  reflexion: "partage une réflexion",
  livre: "lit",
  musique: "écoute",
};

const pillTones = {
  green: "bg-[#E8F4EE] text-[#3F8560]",
  violet: "bg-[#F1ECF8] text-[#7A5AA6]",
  gold: "bg-[#FDF7E8] text-[#9A8232]",
  indigo: "bg-[#EEF0F8] text-[#2A3560]",
};

const categories: { label: string; tone: keyof typeof pillTones }[] = [
  { label: "Géopolitique", tone: "green" },
  { label: "Histoire", tone: "gold" },
  { label: "Philosophie", tone: "violet" },
  { label: "Science", tone: "green" },
  { label: "Art & Design", tone: "violet" },
  { label: "Littérature", tone: "gold" },
  { label: "Musique", tone: "violet" },
  { label: "Cinéma", tone: "indigo" },
  { label: "Économie", tone: "green" },
  { label: "Technologie", tone: "indigo" },
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
  plus: <path d="M12 5v14M5 12h14" />,
  close: <path d="M6 6l12 12M18 6 6 18" />,
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

function timeAgo(date: string) {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `il y a ${days} j`;
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

function inferType(category: string | null, url: string): PostType {
  if (category === "Musique") return "musique";
  if (category === "Littérature") return "livre";
  return url ? "article" : "reflexion";
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

function Actions({ likes }: { likes: number }) {
  const [active, setActive] = useState({
    like: false,
    comment: false,
    share: false,
    bookmark: false,
  });

  const actions: { name: keyof typeof active; label: string; count?: number }[] = [
    { name: "like", label: "Aimer", count: likes + (active.like ? 1 : 0) },
    { name: "comment", label: "Commenter" },
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

function PostCard({ post }: { post: Post }) {
  const author = post.profiles;
  const authorName = author?.name ?? author?.username ?? "Quelqu'un";
  const tone = categories.find((category) => category.label === post.category)?.tone ?? "indigo";
  const link = safeUrl(post.url);

  return (
    <article className="rounded-[10px] border border-[#E8E8E8] bg-white p-5">
      <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#888780]">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#3D4F8C] text-[9px] font-medium text-white">
          {getInitials(author?.name ?? null, author?.username)}
        </span>
        <span>
          <span className="font-medium text-[#1C1B2E]">{authorName}</span>{" "}
          {typeLabels[post.type]} · {timeAgo(post.created_at)}
        </span>
        {post.category && (
          <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-medium ${pillTones[tone]}`}>
            {post.category}
          </span>
        )}
      </div>
      <p className="mt-3 whitespace-pre-wrap break-words text-[14px] leading-relaxed text-[#1C1B2E]">
        {post.content}
      </p>
      {link && (
        <a
          href={link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-3 block truncate rounded-[8px] bg-[#F5F4F0] px-3 py-2 text-[12px] text-[#3D4F8C] hover:underline"
        >
          {link.hostname.replace(/^www\./, "")}
          <span className="text-[#888780]">{link.pathname !== "/" && link.pathname}</span>
        </a>
      )}
      <Actions likes={post.likes_count ?? 0} />
    </article>
  );
}

function SkeletonCard() {
  return (
    <div aria-hidden className="animate-pulse rounded-[10px] border border-[#E8E8E8] bg-white p-5">
      <div className="flex items-center gap-2">
        <span className="h-6 w-6 rounded-full bg-[#F5F4F0]" />
        <span className="h-2.5 w-40 rounded-full bg-[#F5F4F0]" />
      </div>
      <div className="mt-4 h-3 w-full rounded-full bg-[#F5F4F0]" />
      <div className="mt-2 h-3 w-4/5 rounded-full bg-[#F5F4F0]" />
      <div className="mt-2 h-3 w-2/5 rounded-full bg-[#F5F4F0]" />
      <div className="mt-5 h-px bg-[#E8E8E8]" />
      <div className="mt-3 h-2.5 w-32 rounded-full bg-[#F5F4F0]" />
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
  onCreated: (post: Post) => void;
}) {
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
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

    const trimmedUrl = url.trim();
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

    const { data, error: insertError } = await supabase
      .from("posts")
      .insert({
        user_id: user.id,
        type: inferType(category, trimmedUrl),
        content: content.trim(),
        url: trimmedUrl || null,
        category,
      })
      .select(POST_SELECT)
      .single();

    if (insertError) {
      setError(`La publication a échoué : ${insertError.message}`);
      setSubmitting(false);
      return;
    }

    onCreated(data as Post);
  };

  return (
    <div
      className="fixed inset-0 z-30 flex items-center justify-center bg-[#1C1B2E]/40 px-5"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-post-title"
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[480px] rounded-[16px] border border-[#E8E8E8] bg-white p-6"
      >
        <div className="flex items-center justify-between">
          <h2 id="new-post-title" className="font-serif text-[18px] text-[#1C1B2E]">
            Nouveau post
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="text-[#888780] transition-colors hover:text-[#2A3560]"
          >
            <Icon name="close" className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
          <textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            placeholder="Qu'est-ce qui t'intéresse aujourd'hui ?"
            aria-label="Contenu du post"
            rows={4}
            autoFocus
            className="w-full resize-none rounded-[8px] border border-[#E8E8E8] bg-white px-3 py-2.5 text-[13px] leading-relaxed text-[#1C1B2E] outline-none transition-colors placeholder:text-[#888780] focus:border-[#3D4F8C]"
          />
          <input
            type="url"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Lien (optionnel)"
            aria-label="Lien (optionnel)"
            className="h-10 w-full rounded-[8px] border border-[#E8E8E8] bg-white px-3 text-[13px] text-[#1C1B2E] outline-none transition-colors placeholder:text-[#888780] focus:border-[#3D4F8C]"
          />
          <div className="flex flex-wrap gap-1.5">
            {categories.map((item) => (
              <button
                key={item.label}
                type="button"
                aria-pressed={category === item.label}
                onClick={() => setCategory(category === item.label ? null : item.label)}
                className={`rounded-full border px-3 py-1 text-[12px] transition-colors ${
                  category === item.label
                    ? "border-[#2A3560] bg-[#2A3560] text-white"
                    : "border-[#E8E8E8] bg-white text-[#888780] hover:border-[#2A3560] hover:text-[#2A3560]"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {error && (
            <p role="alert" className="text-[12px] text-[#C0392B]">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={content.trim() === "" || submitting}
            className="mt-1 h-10 self-end rounded-[20px] bg-[#2A3560] px-6 text-[13px] font-medium text-white transition-colors hover:bg-[#3D4F8C] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#2A3560]"
          >
            {submitting ? "Publication…" : "Publier"}
          </button>
        </form>
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

export default function Dashboard() {
  const router = useRouter();
  // undefined while the session is still being read, null once known to be absent.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);
  const [filter, setFilter] = useState("Tout");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  // null while the feed is loading.
  const [posts, setPosts] = useState<Post[] | null>(null);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

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
    setPosts(null);
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
      const profileError = user ? await ensureProfile(user) : null;
      if (cancelled) return;
      setProfileError(profileError);

      const { data } = await supabase
        .from("profiles")
        .select("name")
        .eq("id", userId)
        .maybeSingle();
      if (!cancelled) setName(data?.name ?? null);
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
    return <div className="min-h-screen bg-[#F5F4F0]" />;
  }

  const activeType = filters.find((item) => item.label === filter)?.type;
  const visiblePosts = (posts ?? []).filter(
    (post) => filter === "Tout" || post.type === activeType,
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
          <div className="mx-auto max-w-[640px] px-5 pb-24 pt-6">
            <div className="flex flex-wrap gap-2">
              {filters.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => setFilter(item.label)}
                  className={`rounded-full border px-3.5 py-1.5 text-[12px] transition-colors ${
                    filter === item.label
                      ? "border-[#2A3560] bg-[#2A3560] text-white"
                      : "border-[#E8E8E8] bg-white text-[#888780] hover:border-[#2A3560] hover:text-[#2A3560]"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {profileError && (
              <p role="alert" className="mt-4 rounded-[10px] border border-[#E8E8E8] bg-white px-4 py-3 text-[12px] text-[#C0392B]">
                Ton profil n&apos;a pas pu être créé : {profileError}
              </p>
            )}

            <div className="mt-5 flex flex-col gap-4">
              {feedError ? (
                <div role="alert" className="rounded-[10px] border border-[#E8E8E8] bg-white px-5 py-10 text-center">
                  <p className="font-serif text-[16px] text-[#1C1B2E]">
                    Impossible de charger le feed
                  </p>
                  <p className="mt-1.5 text-[12px] text-[#C0392B]">{feedError}</p>
                  <button
                    type="button"
                    onClick={loadPosts}
                    className="mt-4 rounded-md border border-[#E8E8E8] px-4 py-2 text-[12px] text-[#2A3560] transition-colors hover:border-[#2A3560]"
                  >
                    Réessayer
                  </button>
                </div>
              ) : posts === null ? (
                <>
                  <span className="sr-only" role="status">
                    Chargement du feed…
                  </span>
                  <SkeletonCard />
                  <SkeletonCard />
                  <SkeletonCard />
                </>
              ) : posts.length === 0 ? (
                <div className="flex flex-col items-center rounded-[10px] border border-[#E8E8E8] bg-white px-5 py-14 text-center">
                  <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF0F8] text-[#2A3560]">
                    <Icon name="compass" className="h-6 w-6" />
                  </span>
                  <h2 className="mt-4 font-serif text-[18px] text-[#1C1B2E]">
                    Ton feed est vide pour l&apos;instant
                  </h2>
                  <p className="mt-1.5 text-[13px] text-[#888780]">
                    Suis des personnes ou explore du contenu pour commencer
                  </p>
                  <Link
                    href="/explore"
                    className="mt-5 rounded-[20px] bg-[#2A3560] px-5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#3D4F8C]"
                  >
                    Explorer
                  </Link>
                </div>
              ) : (
                <>
                  {/* Hidden rather than unmounted, so likes survive a filter change. */}
                  {posts.map((post) => (
                    <div key={post.id} hidden={!visiblePosts.includes(post)}>
                      <PostCard post={post} />
                    </div>
                  ))}
                  {visiblePosts.length === 0 && (
                    <p className="rounded-[10px] border border-dashed border-[#E8E8E8] px-5 py-10 text-center text-[13px] text-[#888780]">
                      Rien dans « {filter} » pour l&apos;instant.
                    </p>
                  )}
                </>
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

      <button
        type="button"
        onClick={() => setModalOpen(true)}
        aria-label="Nouveau post"
        title="Nouveau post"
        className="fixed bottom-6 right-6 z-20 flex h-12 w-12 items-center justify-center rounded-full bg-[#2A3560] text-white transition-colors hover:bg-[#3D4F8C]"
      >
        <Icon name="plus" className="h-5 w-5" />
      </button>

      {modalOpen && (
        <NewPostModal
          user={session.user}
          onClose={closeModal}
          onCreated={(post) => {
            setPosts((current) => [post, ...(current ?? [])]);
            setModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

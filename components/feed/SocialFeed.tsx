"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { getInitials } from "@/components/Navbar";
import SocialActions, { SocialContext, socialCss, type MyInteractions } from "@/components/dashboard/SocialActions";
import FollowButton from "@/components/feed/FollowButton";
import { avatarTones } from "@/lib/sample-data";
import { bookProgress, bookVerb, displayName, likersLine, postVerb, type FeedEntry, type FeedScope, type Person } from "@/lib/social-feed";
import { supabase } from "@/lib/supabase";

// The social feed: "Mes abonnements" (you + people you follow, newest first)
// and "Découvrir" (everyone, ranked). Each entry says who did what
// ("Léa écoute…"), with likes, who liked and the comment thread. The post body
// itself is drawn by the page (renderPost), so card designs stay in one place.

export type FeedTheme = { ground: string; surface: string; text: string; muted: string; line: string; primary: string; onPrimary: string };

type BasePost = { id: string; user_id: string; type: string; created_at: string; profiles: { id: string; name: string | null; username: string } | null };

const TYPES = [
  { value: "tout", label: "Tout", icon: "✦" },
  { value: "musique", label: "Musique", icon: "♫" },
  { value: "livre", label: "Livres", icon: "📖" },
  { value: "article", label: "Articles", icon: "◉" },
  { value: "reflexion", label: "Réflexions", icon: "✎" },
] as const;
type TypeFilter = (typeof TYPES)[number]["value"];

const PAGE_SIZE = 12;

const tone = (id: string) => avatarTones[((id.charCodeAt(0) || 0) + (id.charCodeAt(1) || 0)) % avatarTones.length];

function timeAgo(iso: string) {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} j`;
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function Avatar({ person, size = 38 }: { person: Person; size?: number }) {
  const { background, color } = tone(person.id);
  return (
    <span
      className="flex shrink-0 items-center justify-center"
      style={{ width: size, height: size, borderRadius: "50%", background, color, fontSize: size * 0.34, fontWeight: 600 }}
    >
      {getInitials(person.name, person.username)}
    </span>
  );
}

/** "Léa écoute · 2 h" with avatar, linking to the person's shelf, and a follow button for strangers. */
function EntryHeader({ person, verb, at, viewerId, followed, onFollow, t }: { person: Person; verb: string; at: string; viewerId: string; followed: boolean; onFollow: (id: string, on: boolean) => void; t: FeedTheme }) {
  return (
    <div className="flex items-center justify-between" style={{ gap: 12, marginBottom: 14 }}>
      <Link href={`/profile?id=${person.id}`} className="flex min-w-0 items-center" style={{ gap: 10, textDecoration: "none" }}>
        <Avatar person={person} />
        <p className="min-w-0" style={{ fontSize: 14, color: t.text, lineHeight: 1.35 }}>
          <strong style={{ fontWeight: 600 }}>{person.id === viewerId ? "Toi" : displayName(person)}</strong> <span style={{ color: t.muted }}>{verb}</span>
          <span style={{ display: "block", fontSize: 12, color: t.muted }}>{timeAgo(at)}</span>
        </p>
      </Link>
      {person.id !== viewerId && !followed && <FollowButton viewerId={viewerId} targetId={person.id} onChange={(on) => onFollow(person.id, on)} colors={t} />}
    </div>
  );
}

function BookEntry({ entry, t }: { entry: Extract<FeedEntry, { kind: "book" }>; t: FeedTheme }) {
  const { book } = entry;
  const progress = bookProgress(book);
  const pct = book.page_total && book.page_current ? Math.min(100, (book.page_current / book.page_total) * 100) : 0;
  return (
    <div className="flex" style={{ gap: 16 }}>
      {book.cover_url?.startsWith("https://") ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={book.cover_url} alt="" style={{ width: 64, height: 96, objectFit: "cover", borderRadius: 4, flexShrink: 0 }} />
      ) : (
        <div style={{ width: 64, height: 96, borderRadius: 4, background: t.ground, flexShrink: 0 }} />
      )}
      <div className="min-w-0">
        <p style={{ fontSize: 16, fontWeight: 600, color: t.text, lineHeight: 1.3 }}>{book.title}</p>
        {book.author && <p style={{ fontSize: 13, color: t.muted, marginTop: 2 }}>{book.author}</p>}
        {progress && (
          <div style={{ marginTop: 10 }}>
            <div style={{ height: 4, borderRadius: 2, background: t.line, width: 160 }}>
              <div style={{ height: 4, borderRadius: 2, background: t.primary, width: `${pct}%` }} />
            </div>
            <p style={{ fontSize: 11, color: t.muted, marginTop: 4 }}>{progress}</p>
          </div>
        )}
      </div>
    </div>
  );
}

/** People to follow: not you, not already followed, most followed first. */
function Suggestions({ viewerId, followed, onFollow, t }: { viewerId: string; followed: Set<string>; onFollow: (id: string, on: boolean) => void; t: FeedTheme }) {
  const [people, setPeople] = useState<Person[] | null>(null);
  useEffect(() => {
    let cancelled = false;
    supabase
      .from("profiles")
      .select("id, name, username")
      .neq("id", viewerId)
      .order("followers_count", { ascending: false })
      .limit(12)
      .then(({ data }) => { if (!cancelled) setPeople((data ?? []) as Person[]); });
    return () => { cancelled = true; };
  }, [viewerId]);

  const shown = (people ?? []).filter((p) => !followed.has(p.id)).slice(0, 5);
  if (!shown.length) return null;
  return (
    <section style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 16, padding: "18px 20px" }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: t.text, marginBottom: 12 }}>Des gens à suivre</p>
      <div className="flex flex-col" style={{ gap: 12 }}>
        {shown.map((person) => (
          <div key={person.id} className="flex items-center justify-between" style={{ gap: 12 }}>
            <Link href={`/profile?id=${person.id}`} className="flex min-w-0 items-center" style={{ gap: 10, textDecoration: "none" }}>
              <Avatar person={person} size={32} />
              <span className="truncate" style={{ fontSize: 13, color: t.text }}>
                {displayName(person)} <span style={{ color: t.muted }}>@{person.username}</span>
              </span>
            </Link>
            <FollowButton viewerId={viewerId} targetId={person.id} onChange={(on) => onFollow(person.id, on)} colors={t} />
          </div>
        ))}
      </div>
    </section>
  );
}

/** A social feed needs people: share the site with friends. */
function InviteCard({ t }: { t: FeedTheme }) {
  const [copied, setCopied] = useState(false);
  const invite = async () => {
    const url = `${window.location.origin}/signup`;
    const text = "Viens sur boredboard : on y voit ce que nos amis écoutent et lisent.";
    try {
      if (navigator.share) { await navigator.share({ url, text }); return; }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
    } catch {
      // Share sheet closed.
    }
  };
  return (
    <section style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 16, padding: "18px 20px" }}>
      <p style={{ fontSize: 14, fontWeight: 600, color: t.text }}>Ton feed, c&apos;est tes amis</p>
      <p style={{ fontSize: 13, color: t.muted, marginTop: 4, lineHeight: 1.5 }}>Invite ceux qui partagent toujours des sons ou des livres dans le groupe.</p>
      <button type="button" onClick={invite} style={{ marginTop: 12, fontSize: 13, fontWeight: 600, padding: "8px 18px", borderRadius: 8, border: "none", cursor: "pointer", background: t.primary, color: t.onPrimary }}>
        {copied ? "Lien copié" : "Inviter des amis"}
      </button>
    </section>
  );
}

export default function SocialFeed<P extends BasePost>({
  session,
  viewerName,
  renderPost,
  refreshKey = 0,
  t,
}: {
  session: Session;
  viewerName: string | null;
  renderPost: (post: P) => ReactNode;
  /** Change it to reload (e.g. after posting). */
  refreshKey?: number;
  t: FeedTheme;
}) {
  const viewerId = session.user.id;
  const [scope, setScope] = useState<FeedScope | null>(null);
  const [type, setType] = useState<TypeFilter>("tout");
  const [entries, setEntries] = useState<FeedEntry<P>[] | null>(null);
  const [followingCount, setFollowingCount] = useState(0);
  const [followed, setFollowed] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    async (wanted: FeedScope | null) => {
      setError(null);
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (!token) return;
      try {
        const res = await fetch(`/api/social-feed?scope=${wanted ?? "following"}`, { headers: { Authorization: `Bearer ${token}` } });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error ?? "Erreur");
        // First visit: start on your circle when you follow someone, else on Découvrir.
        if (wanted === null && body.followingCount === 0) return load("all");
        setScope(body.scope);
        setFollowingCount(body.followingCount);
        setEntries(body.entries);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Impossible de charger le feed");
        setEntries([]);
      }
    },
    [],
  );

  useEffect(() => {
    supabase
      .from("follows")
      .select("following_id")
      .eq("follower_id", viewerId)
      .then(({ data }) => setFollowed(new Set((data ?? []).map((f) => f.following_id as string))));
  }, [viewerId, refreshKey]);

  useEffect(() => {
    void load(scope);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [load, refreshKey]);

  const switchScope = (next: FeedScope) => {
    if (next === scope) return;
    setEntries(null);
    setScope(next);
    void load(next);
  };

  const onFollow = (id: string, on: boolean) => {
    setFollowed((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
    setFollowingCount((n) => n + (on ? 1 : -1));
  };

  const mine = useMemo(() => {
    const byPost: Record<string, MyInteractions> = {};
    for (const entry of entries ?? []) {
      if (entry.kind === "post") byPost[entry.id] = { like: entry.stats.likers.some((p) => p.id === viewerId), reaction: null, comment: null };
    }
    return byPost;
  }, [entries, viewerId]);

  const visible = (entries ?? []).filter((entry) =>
    type === "tout" ? true : entry.kind === "post" ? (entry.post as P).type === type : type === "livre",
  );

  // ── Infinite scroll ──────────────────────────────────────────────────────
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset visible count when filter/scope changes
  useEffect(() => { setVisibleCount(PAGE_SIZE); }, [type, scope]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) setVisibleCount((n) => n + PAGE_SIZE);
      },
      { rootMargin: "400px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [entries, type]);

  const paged = visible.slice(0, visibleCount);
  const hasMore = visibleCount < visible.length;

  const card = { background: t.surface, border: `1px solid ${t.line}`, borderRadius: 16, padding: "20px 22px" };
  const lonely = followingCount < 3;

  // Count entries per type for filter badges
  const counts = useMemo(() => {
    const all = entries ?? [];
    const c: Record<string, number> = { tout: all.length };
    for (const entry of all) {
      const t = entry.kind === "post" ? (entry.post as P).type : "livre";
      c[t] = (c[t] || 0) + 1;
    }
    return c;
  }, [entries]);

  return (
    <SocialContext.Provider value={{ user: session.user, viewerName, mine }}>
      <style>{socialCss}{`
        @keyframes bb-spin { to { transform: rotate(360deg); } }
        .bb-scope-tab { transition: all 0.2s ease; }
        .bb-type-tab { transition: all 0.15s ease; }
      `}</style>
      <div>
        {/* Scope tabs — prominent, centered */}
        <div className="flex" style={{ gap: 4, marginBottom: 18, borderBottom: `1px solid ${t.line}`, paddingBottom: 0 }}>
          {(
            [
              ["following", `Abonnements${followingCount ? ` (${followingCount})` : ""}`],
              ["all", "Découvrir"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              className="bb-scope-tab"
              onClick={() => switchScope(value)}
              style={{
                fontSize: 14,
                fontWeight: scope === value ? 600 : 400,
                padding: "10px 20px",
                cursor: "pointer",
                border: "none",
                borderBottom: scope === value ? `2px solid ${t.primary}` : "2px solid transparent",
                background: "transparent",
                color: scope === value ? t.text : t.muted,
                marginBottom: -1,
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Type filter — with icons and counts */}
        <div className="flex overflow-x-auto" style={{ gap: 6, marginBottom: 22, scrollbarWidth: "none" }}>
          {TYPES.map((option) => {
            const count = counts[option.value] ?? 0;
            const active = type === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className="bb-type-tab"
                onClick={() => setType(option.value)}
                style={{
                  fontSize: 13,
                  padding: "7px 14px",
                  borderRadius: 20,
                  cursor: "pointer",
                  border: active ? "none" : `1px solid ${t.line}`,
                  whiteSpace: "nowrap",
                  background: active ? t.surface : "transparent",
                  color: active ? t.text : t.muted,
                  fontWeight: active ? 600 : 400,
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                }}
              >
                <span style={{ fontSize: 11 }}>{option.icon}</span>
                {option.label}
                {entries !== null && <span style={{ fontSize: 11, opacity: 0.6 }}>({count})</span>}
              </button>
            );
          })}
        </div>

        {error && <p style={{ fontSize: 13, color: "#B4302F", marginBottom: 16 }}>{error}</p>}

        {entries === null ? (
          <div className="flex flex-col" style={{ gap: 16 }}>
            {[0, 1, 2].map((i) => <div key={i} style={{ ...card, height: 160, opacity: 0.5 }} />)}
          </div>
        ) : (
          <div className="flex flex-col" style={{ gap: 16 }}>
            {lonely && <InviteCard t={t} />}
            {lonely && <Suggestions viewerId={viewerId} followed={followed} onFollow={onFollow} t={t} />}

            {paged.length === 0 && visible.length === 0 && (
              <div style={{ ...card, textAlign: "center", padding: "36px 22px" }}>
                <p style={{ fontSize: 15, color: t.text, fontWeight: 600 }}>
                  {scope === "following" ? "Rien de neuf chez les gens que tu suis" : "Rien ici pour le moment"}
                </p>
                {scope === "following" && (
                  <button type="button" onClick={() => switchScope("all")} style={{ marginTop: 12, fontSize: 13, color: t.primary, background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>
                    Voir ce que partagent les autres →
                  </button>
                )}
              </div>
            )}

            {paged.map((entry, i) => (
              <div key={entry.id} className="flex flex-col" style={{ gap: 16 }}>
                {entry.kind === "post" ? (
                  <article style={card}>
                    <EntryHeader
                      person={{ id: entry.post.user_id, name: entry.post.profiles?.name ?? null, username: entry.post.profiles?.username ?? "" }}
                      verb={postVerb(entry.post.type)}
                      at={entry.created_at}
                      viewerId={viewerId}
                      followed={followed.has(entry.post.user_id)}
                      onFollow={onFollow}
                      t={t}
                    />
                    {renderPost(entry.post)}
                    {likersLine(entry.stats.likers, viewerId) && (
                      <p style={{ fontSize: 12, color: t.muted, marginTop: 12 }}>{likersLine(entry.stats.likers, viewerId)}</p>
                    )}
                    <SocialActions
                      likes={entry.stats.likes}
                      comments={entry.stats.comments.length}
                      postId={entry.id}
                      initialComments={entry.stats.comments.map((c) => ({
                        initials: getInitials(c.author.name, c.author.username),
                        name: c.author.id === viewerId ? "Toi" : displayName(c.author),
                        text: c.text,
                        ...tone(c.author.id),
                      }))}
                    />
                  </article>
                ) : (
                  <article style={card}>
                    <EntryHeader person={entry.person} verb={bookVerb(entry.book)} at={entry.created_at} viewerId={viewerId} followed={followed.has(entry.person.id)} onFollow={onFollow} t={t} />
                    <BookEntry entry={entry} t={t} />
                  </article>
                )}
                {!lonely && i === 3 && <Suggestions viewerId={viewerId} followed={followed} onFollow={onFollow} t={t} />}
              </div>
            ))}

            {/* Infinite scroll sentinel */}
            {hasMore && (
              <div ref={sentinelRef} style={{ display: "flex", justifyContent: "center", padding: "24px 0" }}>
                <div style={{ width: 24, height: 24, border: `2px solid ${t.line}`, borderTopColor: t.primary, borderRadius: "50%", animation: "bb-spin 0.6s linear infinite" }} />
              </div>
            )}
          </div>
        )}
      </div>
    </SocialContext.Provider>
  );
}

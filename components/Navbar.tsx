"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/* ── SVG icons — no emojis ─────────────────────────────────────────── */
function IconBell({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function IconSun({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function IconMoon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function IconMenu({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M4 7h16M4 12h12M4 17h8" />
    </svg>
  );
}

function IconX({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

function IconHeart({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" stroke="none">
      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
    </svg>
  );
}

function IconComment({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function IconUser({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function IconChevron({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

/* ── Nav links ─────────────────────────────────────────────────────── */
const memberLinks = [
  { label: "Board", href: "/dashboard", highlight: true },
  { label: "Culture", href: "/culture" },
  { label: "Actualités", href: "/actualites" },
  { label: "Séries & Vidéos", href: "/series" },
  { label: "Forum", href: "/forum" },
  { label: "Explorer", href: "/explore" },
];

const visitorLinks = [
  { label: "Culture", href: "/culture" },
  { label: "Séries & Vidéos", href: "/series" },
  { label: "Forum", href: "/forum" },
  { label: "Explorer", href: "/explore" },
  { label: "Fonctionnalités", href: "/#fonctionnalites" },
  { label: "Manifeste", href: "/#manifeste" },
];

const menuLinks = [
  { label: "Mon profil", href: "/profile" },
  { label: "Paramètres", href: "/settings" },
];

/* ── Logo — Instrument Serif ───────────────────────────────────────── */
export function Logo({ className = "" }: { className?: string }) {
  return (
    <span className={`bb-display flex items-center gap-0 leading-none ${className}`} style={{ fontSize: 20 }}>
      <span style={{ color: "#2A3560" }}>Bored</span>
      <span style={{ color: "var(--bb-gold)" }}>Board</span>
    </span>
  );
}

export function getInitials(name: string | null, email: string | undefined) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email ?? "?").slice(0, 1).toUpperCase();
}

// ── Notification types ───────────────────────────────────────────────
type Notification = {
  id: string;
  type: "like" | "comment" | "follow";
  actor_name: string;
  message: string;
  created_at: string;
  read: boolean;
};

function timeAgoShort(date: string) {
  const mins = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (mins < 1) return "maintenant";
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}j`;
}

function NotificationBell({ userId }: { userId: string }) {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    (async () => {
      const { data: posts } = await supabase
        .from("posts")
        .select("id")
        .eq("user_id", userId);
      if (cancelled || !posts?.length) return;
      const postIds = posts.map((p: { id: string }) => p.id);
      const { data: interactions } = await supabase
        .from("interactions")
        .select("id, user_id, post_id, type, content, created_at")
        .in("post_id", postIds)
        .neq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);
      if (cancelled || !interactions) return;

      const actorIds = [...new Set(interactions.map((i: { user_id: string }) => i.user_id))];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, name, username")
        .in("id", actorIds);

      const profileMap = new Map((profiles ?? []).map((p: { id: string; name: string | null; username: string }) => [p.id, p]));

      const notifs: Notification[] = interactions.map((i: { id: string; user_id: string; type: string; content: string | null; created_at: string }) => {
        const actor = profileMap.get(i.user_id);
        const actorName = actor?.name ?? actor?.username ?? "Quelqu'un";
        return {
          id: i.id,
          type: i.type as "like" | "comment",
          actor_name: actorName,
          message: i.type === "like"
            ? `${actorName} a aimé ton post`
            : i.type === "comment"
              ? `${actorName} a commenté : "${(i.content ?? "").slice(0, 50)}"`
              : `${actorName} a réagi à ton post`,
          created_at: i.created_at,
          read: false,
        };
      });
      if (!cancelled) setNotifications(notifs);
    })();
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded text-[--bb-text-3] transition-colors hover:text-[--bb-text] hover:bg-[--bb-surface]"
      >
        <IconBell size={16} />
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex items-center justify-center"
            style={{
              minWidth: 16, height: 16, borderRadius: 3,
              background: "var(--bb-rose)", color: "white",
              fontSize: 9, fontWeight: 700, padding: "0 4px",
              fontFamily: "var(--font-ui)",
            }}
          >
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-10 z-30"
          style={{
            width: 340, maxHeight: 420, overflowY: "auto",
            background: "var(--bb-white)",
            borderRadius: "var(--bb-radius)",
            border: "1px solid var(--bb-border-strong)",
            boxShadow: "var(--bb-shadow-lg)",
          }}
        >
          <div className="flex items-center justify-between" style={{ padding: "14px 16px 10px", borderBottom: "1px solid var(--bb-border)" }}>
            <span className="bb-ui" style={{ fontSize: 13, fontWeight: 600, color: "var(--bb-text)" }}>Notifications</span>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                className="bb-ui"
                style={{ fontSize: 11, color: "var(--bb-indigo)", background: "none", border: "none", cursor: "pointer" }}
              >
                Tout marquer lu
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center" style={{ padding: "40px 16px", gap: 8 }}>
              <IconBell size={28} />
              <p style={{ fontSize: 13, color: "var(--bb-text-3)" }}>Aucune notification</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 transition-colors hover:bg-[--bb-surface]"
                  style={{ padding: "12px 16px", borderBottom: "1px solid var(--bb-border)" }}
                >
                  <span className="mt-0.5 flex-shrink-0" style={{ color: n.type === "like" ? "var(--bb-rose)" : "var(--bb-indigo)" }}>
                    {n.type === "like" ? <IconHeart size={14} /> : n.type === "comment" ? <IconComment size={14} /> : <IconUser size={14} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: 12, color: "var(--bb-text)", lineHeight: 1.5 }}>{n.message}</p>
                    <p className="bb-ui" style={{ fontSize: 10, color: "var(--bb-text-4)", marginTop: 2 }}>{timeAgoShort(n.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Dark mode toggle ─────────────────────────────────────────────────
export function DarkModeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("bb-dark-mode");
      if (saved === "true") {
        setDark(true);
        document.documentElement.setAttribute("data-theme", "dark");
      }
    } catch { /* no-op */ }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try { localStorage.setItem("bb-dark-mode", String(next)); } catch { /* no-op */ }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? "Mode clair" : "Mode sombre"}
      className="flex h-8 w-8 items-center justify-center rounded text-[--bb-text-3] transition-colors hover:text-[--bb-text] hover:bg-[--bb-surface]"
    >
      {dark ? <IconSun size={16} /> : <IconMoon size={16} />}
    </button>
  );
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });
    return () => subscription.unsubscribe();
  }, []);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) { setName(null); return; }
    let cancelled = false;
    supabase
      .from("profiles")
      .select("name")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => { if (!cancelled) setName(data?.name ?? null); });
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setMenuOpen(false); };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    document.addEventListener("keydown", onKeyDown);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = overflow;
    };
  }, [mobileOpen]);

  const navLinks = session === undefined ? [] : session ? memberLinks : visitorLinks;
  const isActive = (href: string) => pathname === href || (href !== "/dashboard" && pathname.startsWith(href));

  const handleSignOut = async () => {
    setMenuOpen(false);
    setMobileOpen(false);
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <>
      {/* Gold accent line at the very top — signature BoredBoard element */}
      <div style={{ height: 2, background: "linear-gradient(90deg, var(--bb-gold) 0%, var(--bb-gold-muted) 60%, transparent 100%)" }} />

      <header style={{ background: "var(--bb-white)", borderBottom: "1px solid var(--bb-border)" }}>
        <nav className="mx-auto flex h-[56px] max-w-[1140px] items-center justify-between px-6 md:px-10">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <Logo />
          </Link>

          {/* Desktop nav links — centered */}
          <ul className="hidden items-center gap-1 md:flex">
            {navLinks.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  className={`bb-ui relative px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    isActive(link.href)
                      ? "text-[--bb-indigo]"
                      : "highlight" in link && link.highlight
                        ? "text-[--bb-indigo]"
                        : "text-[--bb-text-3] hover:text-[--bb-text]"
                  }`}
                >
                  {link.label}
                  {/* Active indicator — gold square dot, not a generic line */}
                  {isActive(link.href) && (
                    <span className="absolute -bottom-[18px] left-1/2 -translate-x-1/2 bb-gold-dot" />
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {/* Right side */}
          <div className="flex items-center gap-1">
            {/* Mobile hamburger */}
            {session !== undefined && (
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Ouvrir le menu"
                aria-expanded={mobileOpen}
                aria-controls="bb-mobile-menu"
                className="flex h-8 w-8 items-center justify-center rounded text-[--bb-indigo] transition-colors hover:bg-[--bb-surface] md:hidden"
              >
                <IconMenu size={18} />
              </button>
            )}

            {/* Visitor actions */}
            {session === null && (
              <div className="flex items-center gap-2">
                <Link
                  href="/login"
                  className="bb-ui hidden text-[13px] font-medium text-[--bb-text-3] transition-colors hover:text-[--bb-text] sm:block px-3 py-1.5"
                >
                  Connexion
                </Link>
                <Link
                  href="/signup"
                  className="bb-btn-primary"
                  style={{ padding: "7px 18px", fontSize: 12 }}
                >
                  Rejoindre
                </Link>
              </div>
            )}

            {/* Member actions */}
            {session && (
              <div className="flex items-center gap-0.5">
                <DarkModeToggle />
                <NotificationBell userId={session.user.id} />

                <div ref={menuRef} className="relative ml-1">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((o) => !o)}
                    aria-label="Menu du compte"
                    aria-haspopup="menu"
                    aria-expanded={menuOpen}
                    className="bb-ui flex h-8 w-8 items-center justify-center rounded bg-[--bb-indigo] text-[11px] font-semibold text-white transition-colors hover:bg-[--bb-indigo-light]"
                  >
                    {getInitials(name, session.user.email)}
                  </button>
                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute right-0 top-10 z-20 w-48"
                      style={{
                        borderRadius: "var(--bb-radius)",
                        border: "1px solid var(--bb-border-strong)",
                        background: "var(--bb-white)",
                        boxShadow: "var(--bb-shadow-lg)",
                        padding: "4px 0",
                      }}
                    >
                      {menuLinks.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          onClick={() => setMenuOpen(false)}
                          className="bb-ui block px-4 py-2.5 text-[13px] text-[--bb-text] transition-colors hover:bg-[--bb-surface]"
                        >
                          {item.label}
                        </Link>
                      ))}
                      <div className="my-1 mx-3" style={{ height: 1, background: "var(--bb-border)" }} />
                      <button
                        type="button"
                        role="menuitem"
                        onClick={handleSignOut}
                        className="bb-ui block w-full px-4 py-2.5 text-left text-[13px] text-[--bb-text-3] transition-colors hover:bg-[--bb-surface] hover:text-[--bb-text]"
                      >
                        Se déconnecter
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </nav>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          id="bb-mobile-menu"
          role="dialog"
          aria-modal="true"
          aria-label="Menu"
          className="fixed inset-0 z-[60] flex flex-col md:hidden"
          style={{ background: "var(--bb-bg)" }}
        >
          {/* Mobile header */}
          <div className="flex h-[56px] items-center justify-between px-6" style={{ borderBottom: "1px solid var(--bb-border)", background: "var(--bb-white)" }}>
            <Link href="/" onClick={() => setMobileOpen(false)}>
              <Logo />
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Fermer le menu"
              className="flex h-8 w-8 items-center justify-center rounded text-[--bb-indigo] transition-colors hover:bg-[--bb-surface]"
            >
              <IconX size={18} />
            </button>
          </div>

          {/* Mobile links */}
          <ul className="flex flex-col px-6 py-8">
            {[...navLinks, ...(session ? menuLinks : [])].map((link, i) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`bb-display block py-4 text-[26px] transition-colors ${
                    isActive(link.href) ? "text-[--bb-indigo]" : "text-[--bb-text]"
                  }`}
                  style={{
                    borderBottom: "1px solid var(--bb-border)",
                    animationDelay: `${i * 40}ms`,
                  }}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          {/* Mobile bottom actions */}
          <div className="mt-auto flex flex-col gap-3 px-6 pb-10">
            {/* Gold accent line */}
            <div className="bb-gold-line mb-4" />

            {session ? (
              <button
                type="button"
                onClick={handleSignOut}
                className="bb-ui rounded border py-3 text-[14px] text-[--bb-text-3]"
                style={{ borderColor: "var(--bb-border)" }}
              >
                Se déconnecter
              </button>
            ) : (
              <>
                <Link
                  href="/login"
                  onClick={() => setMobileOpen(false)}
                  className="bb-ui rounded border py-3 text-center text-[14px] text-[--bb-indigo]"
                  style={{ borderColor: "var(--bb-border)" }}
                >
                  Connexion
                </Link>
                <Link
                  href="/signup"
                  onClick={() => setMobileOpen(false)}
                  className="bb-btn-primary rounded py-3 text-center text-[14px]"
                >
                  Rejoindre
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

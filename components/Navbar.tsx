"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const memberLinks = [
  { label: "Board", href: "/dashboard", highlight: true },
  { label: "Actualités", href: "/actualites" },
  { label: "Explorer", href: "/explore" },
];

const visitorLinks = [
  { label: "Explorer", href: "/explore" },
  { label: "Fonctionnalités", href: "/#fonctionnalites" },
  { label: "Manifeste", href: "/#manifeste" },
];

const menuLinks = [
  { label: "Mon profil", href: "/profile" },
  { label: "Paramètres", href: "/settings" },
];

function BoardIcon({ size = 24 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 80 80"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <rect x="4" y="4" width="72" height="72" rx="8" stroke="currentColor" strokeWidth="3.5" />
      <rect x="14" y="14" width="20" height="20" rx="3" fill="#C4A94A" />
      <rect x="40" y="14" width="26" height="8" rx="2" fill="currentColor" opacity="0.3" />
      <rect x="40" y="28" width="18" height="6" rx="2" fill="currentColor" opacity="0.15" />
      <rect x="14" y="42" width="52" height="8" rx="2" fill="currentColor" opacity="0.2" />
      <rect x="14" y="56" width="38" height="8" rx="2" fill="#C4A94A" opacity="0.4" />
      <circle cx="62" cy="60" r="6" fill="currentColor" opacity="0.15" />
    </svg>
  );
}

export function Logo({ className = "text-[18px]" }: { className?: string }) {
  return (
    <span className={`flex items-center gap-2 font-serif ${className} leading-none text-[#2A3560]`}>
      <BoardIcon size={className.includes("text-[2") ? 28 : 22} />
      <span>
        <span className="text-[#2A3560]">Bored</span>
        <span className="text-[#C4A94A]">Board</span>
      </span>
    </span>
  );
}

export function getInitials(name: string | null, email: string | undefined) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email ?? "?").slice(0, 1).toUpperCase();
}

// ── Notification types ───────────────────────────────────────────────────
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

  // Load recent interactions (likes/comments on user's posts)
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

      // Get profiles for actors
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

  // Close on outside click
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
  const icon = "\u{1F514}";

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          // Mark all as read
          if (!open) setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
        }}
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[#F5F4F0]"
      >
        <span style={{ fontSize: 16 }}>{icon}</span>
        {unread > 0 && (
          <span
            className="absolute -right-0.5 -top-0.5 flex items-center justify-center"
            style={{
              minWidth: 16,
              height: 16,
              borderRadius: 8,
              background: "#D4537E",
              color: "white",
              fontSize: 9,
              fontWeight: 700,
              padding: "0 4px",
              border: "2px solid white",
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
            width: 320,
            maxHeight: 400,
            overflowY: "auto",
            background: "white",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.08)",
            boxShadow: "0 12px 40px rgba(0,0,0,0.12)",
          }}
        >
          <div className="flex items-center justify-between" style={{ padding: "14px 16px 10px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#1C1A15" }}>Notifications</span>
            {notifications.length > 0 && (
              <button
                type="button"
                onClick={() => setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))}
                style={{ fontSize: 11, color: "#2A3560", background: "none", border: "none", cursor: "pointer" }}
              >
                Tout marquer lu
              </button>
            )}
          </div>
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center" style={{ padding: "32px 16px", gap: 8 }}>
              <span style={{ fontSize: 32 }}>{icon}</span>
              <p style={{ fontSize: 13, color: "rgba(28,26,21,0.4)" }}>Aucune notification</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {notifications.map((n) => (
                <div
                  key={n.id}
                  className="flex items-start gap-3 transition-colors hover:bg-[#F7F4EE]"
                  style={{ padding: "10px 16px", borderBottom: "1px solid rgba(0,0,0,0.04)" }}
                >
                  <span style={{ fontSize: 18, marginTop: 2 }}>
                    {n.type === "like" ? "❤️" : n.type === "comment" ? "\u{1F4AC}" : "\u{1F464}"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p style={{ fontSize: 12, color: "#1C1A15", lineHeight: 1.4 }}>{n.message}</p>
                    <p style={{ fontSize: 10, color: "rgba(28,26,21,0.35)", marginTop: 2 }}>{timeAgoShort(n.created_at)}</p>
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

// ── Dark mode toggle ─────────────────────────────────────────────────────
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
      className="flex h-8 w-8 items-center justify-center rounded-full transition-colors hover:bg-[#F5F4F0]"
      style={{ fontSize: 16 }}
    >
      {dark ? "☀️" : "\u{1F319}"}
    </button>
  );
}

export default function Navbar() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
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

  const handleSignOut = async () => {
    setMenuOpen(false);
    setMobileOpen(false);
    await supabase.auth.signOut();
    router.push("/");
  };

  return (
    <header className="border-b border-[#E8E8E8] bg-white">
      <nav className="mx-auto grid h-[52px] max-w-[1120px] grid-cols-[1fr_auto_1fr] items-center px-6 md:px-10">
        <Link href="/">
          <Logo />
        </Link>
        <ul className="hidden items-center gap-8 md:flex">
          {navLinks.map((link) => (
            <li key={link.label}>
              <Link
                href={link.href}
                className={`text-[13px] transition-colors ${
                  "highlight" in link && link.highlight
                    ? "font-semibold text-[#2A3560] hover:text-[#3D4F8C]"
                    : "text-[#888780] hover:text-[#2A3560]"
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="col-start-3 flex items-center justify-end gap-1.5">
          {session !== undefined && (
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Ouvrir le menu"
              aria-expanded={mobileOpen}
              aria-controls="bb-mobile-menu"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[18px] text-[#2A3560] transition-colors hover:bg-[#F5F4F0] md:hidden"
            >
              ☰
            </button>
          )}
          {session === null && (
            <>
              <Link href="/login" className="hidden rounded-md border border-[#E8E8E8] px-3.5 py-1.5 text-[13px] text-[#2A3560] transition-colors hover:border-[#2A3560] sm:block">
                Connexion
              </Link>
              <Link href="/signup" className="rounded-md bg-[#2A3560] px-3.5 py-1.5 text-[13px] text-white transition-colors hover:bg-[#3D4F8C]">
                Rejoindre
              </Link>
            </>
          )}
          {session && (
            <>
              <DarkModeToggle />
              <NotificationBell userId={session.user.id} />
              <div ref={menuRef} className="relative ml-1">
                <button
                  type="button"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label="Menu du compte"
                  aria-haspopup="menu"
                  aria-expanded={menuOpen}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-[#2A3560] text-[11px] font-medium text-white transition-colors hover:bg-[#3D4F8C]"
                >
                  {getInitials(name, session.user.email)}
                </button>
                {menuOpen && (
                  <div
                    role="menu"
                    className="absolute right-0 top-10 z-20 w-44 rounded-[10px] border border-[#E8E8E8] bg-white py-1.5"
                  >
                    {menuLinks.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        onClick={() => setMenuOpen(false)}
                        className="block px-3.5 py-2 text-[13px] text-[#1C1B2E] transition-colors hover:bg-[#F5F4F0]"
                      >
                        {item.label}
                      </Link>
                    ))}
                    <div className="my-1.5 h-px bg-[#E8E8E8]" />
                    <button
                      type="button"
                      role="menuitem"
                      onClick={handleSignOut}
                      className="block w-full px-3.5 py-2 text-left text-[13px] text-[#888780] transition-colors hover:bg-[#F5F4F0] hover:text-[#2A3560]"
                    >
                      Se déconnecter
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </nav>

      {mobileOpen && (
        <div id="bb-mobile-menu" role="dialog" aria-modal="true" aria-label="Menu" className="fixed inset-0 z-[60] flex flex-col bg-[#F7F4EE] md:hidden">
          <div className="flex h-[52px] items-center justify-between border-b border-[#E8E8E8] bg-white px-6">
            <Link href="/" onClick={() => setMobileOpen(false)}>
              <Logo />
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Fermer le menu"
              className="flex h-8 w-8 items-center justify-center rounded-md text-[18px] text-[#2A3560] transition-colors hover:bg-[#F0EBE1]"
            >
              ✕
            </button>
          </div>
          <ul className="flex flex-col px-6 py-6">
            {[...navLinks, ...(session ? menuLinks : [])].map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className={`block border-b border-black/[0.06] py-4 font-serif text-[22px] ${
                    "highlight" in link && link.highlight ? "text-[#2A3560]" : "text-[#1C1A15]"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-auto flex flex-col gap-3 px-6 pb-10">
            {session ? (
              <button type="button" onClick={handleSignOut} className="rounded-xl border border-black/[0.1] py-3 text-[14px] text-[#888780]">
                Se déconnecter
              </button>
            ) : (
              <>
                <Link href="/login" onClick={() => setMobileOpen(false)} className="rounded-xl border border-black/[0.1] py-3 text-center text-[14px] text-[#2A3560]">
                  Connexion
                </Link>
                <Link href="/signup" onClick={() => setMobileOpen(false)} className="rounded-xl bg-[#2A3560] py-3 text-center text-[14px] text-white">
                  Rejoindre
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}

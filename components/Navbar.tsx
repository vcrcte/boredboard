"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const navLinks = ["Explorer", "Fonctionnalités", "Manifeste"];

const menuLinks = [
  { label: "Mon profil", href: "/profile" },
  { label: "Paramètres", href: "/settings" },
];

export function Logo({ className = "text-[18px]" }: { className?: string }) {
  return (
    <span className={`font-serif ${className} leading-none`}>
      <span className="text-[#2A3560]">Bored</span>
      <span className="text-[#C4A94A]">Board</span>
    </span>
  );
}

export function getInitials(name: string | null, email: string | undefined) {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 1) return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (email ?? "?").slice(0, 1).toUpperCase();
}

export default function Navbar() {
  const router = useRouter();
  // undefined while the session is still being read, null once known to be absent.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [name, setName] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
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
    if (!userId) {
      setName(null);
      return;
    }
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

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  const handleSignOut = async () => {
    setMenuOpen(false);
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
            <li key={link}>
              <a href="#" className="text-[13px] text-[#888780] transition-colors hover:text-[#2A3560]">
                {link}
              </a>
            </li>
          ))}
        </ul>
        <div className="col-start-3 flex items-center justify-end gap-2">
          {session === null && (
            <>
              <Link href="/login" className="hidden rounded-md border border-[#E8E8E8] px-3.5 py-1.5 text-[13px] text-[#2A3560] transition-colors hover:border-[#2A3560] sm:block">
                Se connecter
              </Link>
              <Link href="/signup" className="rounded-md bg-[#2A3560] px-3.5 py-1.5 text-[13px] text-white transition-colors hover:bg-[#3D4F8C]">
                Rejoindre
              </Link>
            </>
          )}
          {session && (
            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
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
          )}
        </div>
      </nav>
    </header>
  );
}

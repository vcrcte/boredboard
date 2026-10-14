"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { displayName, type Person } from "@/lib/social-feed";
import { supabase } from "@/lib/supabase";

// Likes and comments on your posts, and new followers. "Unread" is anything
// newer than the last time this device opened the list (localStorage only).

type Notice = { id: string; at: string; person: Person; text: string };

const SEEN_KEY = "bb-notifications-seen";
const one = <T,>(value: T | T[] | null): T | null => (Array.isArray(value) ? (value[0] ?? null) : value);
const short = (text: string, max = 60) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

async function loadNotices(userId: string): Promise<Notice[]> {
  const { data: posts } = await supabase.from("posts").select("id, content").eq("user_id", userId).order("created_at", { ascending: false }).limit(100);
  const titles = new Map((posts ?? []).map((p) => [p.id as string, short((p.content as string).replace(/^J'écoute "?|"$/g, ""), 40)]));

  const [{ data: interactions }, { data: followers }] = await Promise.all([
    titles.size
      ? supabase
          .from("interactions")
          .select("id, post_id, user_id, type, content, created_at, profiles (id, name, username)")
          .in("post_id", [...titles.keys()])
          .in("type", ["like", "comment"])
          .neq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(30)
      : Promise.resolve({ data: [] }),
    supabase
      .from("follows")
      .select("follower_id, created_at, follower:profiles!follows_follower_id_fkey (id, name, username)")
      .eq("following_id", userId)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const notices: Notice[] = [];
  for (const row of interactions ?? []) {
    const person = one(row.profiles as Person | Person[] | null) ?? { id: row.user_id, name: null, username: "" };
    const title = titles.get(row.post_id) ?? "ton post";
    notices.push({
      id: `i-${row.id}`,
      at: row.created_at,
      person,
      text: row.type === "like" ? `a aimé « ${title} »` : `a commenté « ${title} » : ${short(row.content ?? "")}`,
    });
  }
  for (const row of followers ?? []) {
    const person = one(row.follower as Person | Person[] | null) ?? { id: row.follower_id, name: null, username: "" };
    notices.push({ id: `f-${row.follower_id}`, at: row.created_at, person, text: "te suit" });
  }
  return notices.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 30);
}

export default function NotificationsBell({ userId, colors }: { userId: string; colors: { surface: string; text: string; muted: string; line: string; primary: string } }) {
  const [notices, setNotices] = useState<Notice[]>([]);
  const [seen, setSeen] = useState<string>("");
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      setSeen(localStorage.getItem(SEEN_KEY) ?? "");
    } catch {
      // No storage: everything stays unread until opened in this tab.
    }
    let cancelled = false;
    loadNotices(userId).then((list) => { if (!cancelled) setNotices(list); }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId]);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  const unread = notices.filter((n) => n.at > seen).length;

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && notices[0]) {
      // Keep the old mark while the list is open so new items stay highlighted.
      try {
        localStorage.setItem(SEEN_KEY, notices[0].at);
      } catch {
        // Not remembered.
      }
    } else if (!next && notices[0]) {
      setSeen(notices[0].at);
    }
  };

  return (
    <div ref={box} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={toggle}
        aria-label={unread ? `${unread} notifications non lues` : "Notifications"}
        style={{ position: "relative", width: 34, height: 34, borderRadius: "50%", border: `1px solid ${colors.line}`, background: "transparent", color: colors.text, cursor: "pointer", fontSize: 15 }}
      >
        ♡
        {unread > 0 && (
          <span style={{ position: "absolute", top: -4, right: -4, minWidth: 17, height: 17, borderRadius: 9, background: "#E0457B", color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 42, width: "min(340px, calc(100vw - 32px))", maxHeight: 420, overflowY: "auto", background: colors.surface, border: `1px solid ${colors.line}`, borderRadius: 12, boxShadow: "0 12px 32px rgba(0,0,0,0.18)", zIndex: 50 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: colors.text, padding: "14px 16px 8px" }}>Activité</p>
          {notices.length === 0 ? (
            <p style={{ fontSize: 13, color: colors.muted, padding: "4px 16px 16px", lineHeight: 1.5 }}>Quand quelqu&apos;un aime, commente ou te suit, ça apparaît ici.</p>
          ) : (
            notices.map((n) => (
              <Link
                key={n.id}
                href={`/profile?id=${n.person.id}`}
                style={{ display: "block", padding: "10px 16px", fontSize: 13, lineHeight: 1.45, color: colors.text, textDecoration: "none", borderTop: `1px solid ${colors.line}`, background: n.at > seen ? "rgba(224,69,123,0.06)" : "transparent" }}
              >
                <strong style={{ fontWeight: 600 }}>{displayName(n.person)}</strong> <span style={{ color: colors.muted }}>{n.text}</span>
              </Link>
            ))
          )}
        </div>
      )}
    </div>
  );
}

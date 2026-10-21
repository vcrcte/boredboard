"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getInitials } from "@/components/Navbar";
import { avatarTones } from "@/lib/sample-data";

type Theme = {
  ground: string; surface: string; text: string;
  muted: string; primary: string; onPrimary: string;
  line: string;
};

const UI = "Satoshi, system-ui, sans-serif";
const DISPLAY = "'Cabinet Grotesk', system-ui, sans-serif";

type TrendingPost = {
  id: string;
  user_id: string;
  type: string;
  content: string;
  url: string | null;
  category: string | null;
  likes_count: number | null;
  interaction_count: number;
  profiles: { id: string; name: string | null; username: string; avatar_url: string | null } | null;
};

const typeIcon: Record<string, string> = {
  musique: "♫",
  livre: "📚",
  article: "📰",
  reflexion: "💭",
};

const tone = (id: string) => avatarTones[((id.charCodeAt(0) || 0) + (id.charCodeAt(1) || 0)) % avatarTones.length];

function truncate(text: string, max: number) {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

export default function TrendingSidebar({ t }: { t: Theme }) {
  const [posts, setPosts] = useState<TrendingPost[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/trending")
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!cancelled && data?.posts) setPosts(data.posts);
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 16, padding: 20 }}>
        <div className="animate-pulse">
          <div style={{ width: 120, height: 16, background: t.ground, borderRadius: 4, marginBottom: 16 }} />
          {[0, 1, 2].map((i) => (
            <div key={i} style={{ marginBottom: 14 }}>
              <div style={{ width: "80%", height: 12, background: t.ground, borderRadius: 4, marginBottom: 6 }} />
              <div style={{ width: "50%", height: 10, background: t.ground, borderRadius: 4 }} />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (posts.length === 0) return null;

  return (
    <div style={{ background: t.surface, border: `1px solid ${t.line}`, borderRadius: 16, padding: 20 }}>
      <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, fontFamily: DISPLAY, marginBottom: 16, display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{ fontSize: 14 }}>{"🔥"}</span> Tendances
      </h3>
      <div className="flex flex-col" style={{ gap: 14 }}>
        {posts.slice(0, 6).map((post, index) => {
          const authorName = post.profiles?.name ?? post.profiles?.username ?? "";
          const authorTone = tone(post.user_id);
          const icon = typeIcon[post.type] ?? "✨";
          const title = post.type === "musique"
            ? (post.content.replace(/^J'écoute "?|"$/g, "").slice(0, 50))
            : truncate(post.content, 60);

          return (
            <Link
              key={post.id}
              href={`/post/${post.id}`}
              style={{ textDecoration: "none", display: "flex", gap: 10 }}
            >
              <span style={{
                fontSize: 13, fontWeight: 700, color: t.muted,
                fontFamily: UI, width: 18, textAlign: "right", flexShrink: 0,
                paddingTop: 1,
              }}>
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <p style={{ fontSize: 13, fontWeight: 500, color: t.text, fontFamily: UI, lineHeight: 1.35 }}>
                  {icon} {title}
                </p>
                <div className="flex items-center" style={{ gap: 6, marginTop: 4 }}>
                  <span
                    className="flex shrink-0 items-center justify-center"
                    style={{
                      width: 16, height: 16, borderRadius: "50%",
                      background: authorTone.background, color: authorTone.color,
                      fontSize: 7, fontWeight: 600,
                    }}
                  >
                    {getInitials(post.profiles?.name ?? null, post.profiles?.username ?? "")}
                  </span>
                  <span style={{ fontSize: 11, color: t.muted, fontFamily: UI }}>
                    {authorName}
                  </span>
                  <span style={{ fontSize: 10, color: t.muted, opacity: 0.6 }}>&middot;</span>
                  <span style={{ fontSize: 11, color: t.muted, fontFamily: UI }}>
                    {post.interaction_count} interactions
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

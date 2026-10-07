"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import {
  getVideoThemes,
  getUserVideoSubscriptions,
  subscribeVideo,
  unsubscribeVideo,
  VIDEO_SOURCES,
  type VideoSource,
  type VideoSubscription,
} from "@/lib/videos";
import { supabase } from "@/lib/supabase";

const CREAM = "#F7F4EE";
const INDIGO = "#2A3560";
const TEXT = "#1C1A15";
const WHITE = "#FFFFFF";
const GEORGIA = "Georgia, 'Times New Roman', serif";
const ink = (a: number) => `rgba(28,26,21,${a})`;
const black = (a: number) => `rgba(0,0,0,${a})`;
const DIM = ink(0.4);
const GREEN = "#16A34A";
const YT_RED = "#FF0000";

const card: CSSProperties = {
  background: WHITE,
  border: `1px solid ${black(0.07)}`,
  borderRadius: 14,
  overflow: "hidden",
};

function VideoCard({
  source,
  subscribed,
  toggling,
  onToggle,
  expanded,
  onExpand,
}: {
  source: VideoSource;
  subscribed: boolean;
  toggling: boolean;
  onToggle: () => void;
  expanded: boolean;
  onExpand: () => void;
}) {
  return (
    <article style={card} className="flex flex-col">
      {/* YouTube embed / thumbnail */}
      <div
        className="relative cursor-pointer"
        style={{ aspectRatio: "16/9", background: black(0.04) }}
        onClick={onExpand}
      >
        {expanded ? (
          <iframe
            src={`https://www.youtube.com/embed/${source.featured_video_id}?autoplay=1`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="absolute inset-0 h-full w-full"
            style={{ border: "none" }}
          />
        ) : (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`https://img.youtube.com/vi/${source.featured_video_id}/mqdefault.jpg`}
              alt={source.name}
              className="absolute inset-0 h-full w-full object-cover"
            />
            <div
              className="absolute inset-0 flex items-center justify-center"
              style={{ background: "rgba(0,0,0,0.2)" }}
            >
              <span
                className="flex items-center justify-center"
                style={{
                  width: 48,
                  height: 48,
                  borderRadius: "50%",
                  background: "rgba(255,0,0,0.9)",
                  color: WHITE,
                  fontSize: 20,
                }}
              >
                ▶
              </span>
            </div>
          </>
        )}
      </div>

      <div style={{ padding: 16 }}>
        <div className="flex items-start gap-3">
          <span
            className="flex shrink-0 items-center justify-center"
            style={{ width: 36, height: 36, borderRadius: 10, background: `${source.color}12`, fontSize: 18 }}
          >
            {source.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate" style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>{source.name}</p>
            <p className="mt-0.5" style={{ fontSize: 12, color: DIM, lineHeight: 1.5 }}>{source.description}</p>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center" style={{ gap: 8 }}>
            <span
              style={{
                fontSize: 10,
                padding: "3px 10px",
                borderRadius: 10,
                background: `${source.color}12`,
                color: source.color,
              }}
            >
              {source.theme}
            </span>
            <a
              href={source.channel_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 transition hover:underline"
              style={{ fontSize: 11, color: YT_RED }}
            >
              <span style={{ fontSize: 12 }}>●</span> YouTube
            </a>
          </div>

          <button
            type="button"
            onClick={onToggle}
            disabled={toggling}
            className="shrink-0 transition disabled:opacity-50"
            style={{
              fontSize: 12,
              padding: "6px 16px",
              borderRadius: 20,
              fontWeight: 500,
              ...(subscribed
                ? { background: `${GREEN}14`, color: GREEN, border: `1px solid ${GREEN}30` }
                : { background: INDIGO, color: CREAM }),
            }}
          >
            {toggling ? "…" : subscribed ? "✓ Suivi" : "Suivre"}
          </button>
        </div>
      </div>
    </article>
  );
}

type Tab = "parcourir" | "abonnements";

export default function Videos() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("parcourir");
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [subs, setSubs] = useState<VideoSubscription[] | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setSession(data.session);
    });
  }, [router]);

  const userId = session?.user.id;

  const loadSubs = useCallback(async () => {
    if (!userId) return;
    const list = await getUserVideoSubscriptions(userId);
    setSubs(list);
  }, [userId]);

  useEffect(() => { loadSubs(); }, [loadSubs]);

  const subscribedIds = new Set((subs ?? []).map((s) => s.source_id));

  const handleToggle = async (sourceId: string) => {
    if (!userId) return;
    setToggling((prev) => new Set(prev).add(sourceId));
    if (subscribedIds.has(sourceId)) {
      await unsubscribeVideo(userId, sourceId);
    } else {
      await subscribeVideo(userId, sourceId);
    }
    await loadSubs();
    setToggling((prev) => { const next = new Set(prev); next.delete(sourceId); return next; });
  };

  if (!session) return <div className="min-h-screen" style={{ background: CREAM }} />;

  const themes = getVideoThemes();
  const filteredSources = themeFilter
    ? VIDEO_SOURCES.filter((s) => s.theme === themeFilter)
    : VIDEO_SOURCES;
  const subscribedSources = VIDEO_SOURCES.filter((s) => subscribedIds.has(s.id));

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <Navbar />
      <main className="mx-auto px-4 sm:px-6" style={{ maxWidth: 800, paddingBlock: 32 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 style={{ fontFamily: GEORGIA, fontSize: 28, fontWeight: 400, color: TEXT }}>Vidéos</h1>
            <p className="mt-1" style={{ fontSize: 13, color: DIM }}>Les meilleures chaînes YouTube culturelles</p>
          </div>
          {subscribedIds.size > 0 && (
            <span style={{ fontSize: 12, color: YT_RED, fontWeight: 500, padding: "6px 14px", background: `${YT_RED}10`, borderRadius: 20 }}>
              {subscribedIds.size} chaîne{subscribedIds.size > 1 ? "s" : ""} suivie{subscribedIds.size > 1 ? "s" : ""}
            </span>
          )}
        </div>

        <div className="mt-6 flex" style={{ gap: 6 }}>
          {([
            { value: "parcourir" as Tab, label: "Parcourir", icon: "🔍" },
            { value: "abonnements" as Tab, label: "Mes chaînes", icon: "📺" },
          ]).map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className="flex items-center"
              style={{
                fontSize: 12, padding: "7px 16px", borderRadius: 20, gap: 6, transition: "background-color 0.15s",
                ...(tab === t.value ? { background: INDIGO, color: CREAM } : { background: black(0.05), color: ink(0.5) }),
              }}
            >
              <span aria-hidden style={{ fontSize: 13 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {tab === "parcourir" && (
          <>
            <div className="mt-5 flex flex-wrap" style={{ gap: 6 }}>
              <button
                type="button"
                onClick={() => setThemeFilter(null)}
                style={{
                  fontSize: 11, padding: "5px 14px", borderRadius: 20,
                  ...(themeFilter === null ? { background: INDIGO, color: CREAM } : { background: black(0.05), color: ink(0.5) }),
                }}
              >
                Tous
              </button>
              {themes.map((theme) => (
                <button
                  key={theme}
                  type="button"
                  onClick={() => setThemeFilter(themeFilter === theme ? null : theme)}
                  style={{
                    fontSize: 11, padding: "5px 14px", borderRadius: 20,
                    ...(themeFilter === theme ? { background: INDIGO, color: CREAM } : { background: black(0.05), color: ink(0.5) }),
                  }}
                >
                  {theme}
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
              {filteredSources.map((source) => (
                <VideoCard
                  key={source.id}
                  source={source}
                  subscribed={subscribedIds.has(source.id)}
                  toggling={toggling.has(source.id)}
                  onToggle={() => handleToggle(source.id)}
                  expanded={expanded === source.id}
                  onExpand={() => setExpanded(expanded === source.id ? null : source.id)}
                />
              ))}
            </div>
          </>
        )}

        {tab === "abonnements" && (
          <>
            {subscribedSources.length === 0 ? (
              <div className="mt-6 text-center" style={{ ...card, padding: 48 }}>
                <p style={{ fontSize: 28 }}>📺</p>
                <p className="mt-2" style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>Aucune chaîne suivie</p>
                <p className="mx-auto mt-1" style={{ fontSize: 12, color: DIM, maxWidth: 300, lineHeight: 1.5 }}>
                  Découvre les chaînes YouTube culturelles et suis celles qui te plaisent.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("parcourir")}
                  className="mt-4 transition hover:brightness-110"
                  style={{ background: INDIGO, color: CREAM, borderRadius: 20, padding: "9px 20px", fontSize: 12, fontWeight: 500 }}
                >
                  Parcourir les chaînes
                </button>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                {subscribedSources.map((source) => (
                  <VideoCard
                    key={source.id}
                    source={source}
                    subscribed
                    toggling={toggling.has(source.id)}
                    onToggle={() => handleToggle(source.id)}
                    expanded={expanded === source.id}
                    onExpand={() => setExpanded(expanded === source.id ? null : source.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}

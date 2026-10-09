"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import {
  getPodcastThemes,
  getUserPodcastSubscriptions,
  podcastFrequencyLabel,
  PODCAST_SOURCES,
  subscribePodcast,
  unsubscribePodcast,
  type PodcastSource,
  type PodcastSubscription,
} from "@/lib/podcasts";
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

const card: CSSProperties = {
  background: WHITE,
  border: `1px solid ${black(0.07)}`,
  borderRadius: 14,
  padding: 16,
};

// ── Podcast Card ──────────────────────────────────────────────────────

function PodcastCard({
  source,
  subscribed,
  toggling,
  onToggle,
}: {
  source: PodcastSource;
  subscribed: boolean;
  toggling: boolean;
  onToggle: () => void;
}) {
  return (
    <article style={card} className="flex flex-col">
      <div className="flex items-start gap-3">
        <span
          className="flex shrink-0 items-center justify-center"
          style={{ width: 44, height: 44, borderRadius: 12, background: `${source.color}12`, fontSize: 22 }}
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
          <span style={{ fontSize: 10, color: DIM }}>
            {podcastFrequencyLabel(source.frequency)}
          </span>
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
          {toggling ? "…" : subscribed ? "✓ Abonné" : "S'abonner"}
        </button>
      </div>

      {/* Listen links */}
      <div className="mt-2 flex items-center" style={{ gap: 8 }}>
        <a
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="truncate transition hover:underline"
          style={{ fontSize: 11, color: INDIGO }}
        >
          ↗ Site
        </a>
        {source.spotify_url && (
          <a
            href={source.spotify_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 transition hover:underline"
            style={{ fontSize: 11, color: "#1DB954" }}
          >
            <span style={{ fontSize: 12 }}>●</span> Spotify
          </a>
        )}
        {source.apple_url && (
          <a
            href={source.apple_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 transition hover:underline"
            style={{ fontSize: 11, color: "#A855F7" }}
          >
            <span style={{ fontSize: 12 }}>●</span> Apple
          </a>
        )}
      </div>
    </article>
  );
}

// ── Main page ──────────────────────────────────────────────────────────

type Tab = "parcourir" | "abonnements";

const tabs: { value: Tab; label: string; icon: string }[] = [
  { value: "parcourir", label: "Parcourir", icon: "◎" },
  { value: "abonnements", label: "Mes abonnements", icon: "◎" },
];

export default function Podcasts() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("parcourir");
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [subs, setSubs] = useState<PodcastSubscription[] | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setSession(data.session);
    });
  }, [router]);

  const userId = session?.user.id;

  const loadSubs = useCallback(async () => {
    if (!userId) return;
    const list = await getUserPodcastSubscriptions(userId);
    setSubs(list);
  }, [userId]);

  useEffect(() => { loadSubs(); }, [loadSubs]);

  const subscribedIds = new Set((subs ?? []).map((s) => s.source_id));

  const handleToggle = async (sourceId: string) => {
    if (!userId) return;
    setToggling((prev) => new Set(prev).add(sourceId));
    if (subscribedIds.has(sourceId)) {
      await unsubscribePodcast(userId, sourceId);
    } else {
      await subscribePodcast(userId, sourceId);
    }
    await loadSubs();
    setToggling((prev) => {
      const next = new Set(prev);
      next.delete(sourceId);
      return next;
    });
  };

  if (!session) return <div className="min-h-screen" style={{ background: CREAM }} />;

  const themes = getPodcastThemes();
  const filteredSources = themeFilter
    ? PODCAST_SOURCES.filter((s) => s.theme === themeFilter)
    : PODCAST_SOURCES;

  const subscribedSources = PODCAST_SOURCES.filter((s) => subscribedIds.has(s.id));

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <Navbar />

      <main className="mx-auto px-4 sm:px-6" style={{ maxWidth: 800, paddingBlock: 32 }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 style={{ fontFamily: GEORGIA, fontSize: 28, fontWeight: 400, color: TEXT }}>Podcasts</h1>
            <p className="mt-1" style={{ fontSize: 13, color: DIM }}>
              Les meilleurs podcasts culturels français
            </p>
          </div>
          {subscribedIds.size > 0 && (
            <span style={{ fontSize: 12, color: GREEN, fontWeight: 500, padding: "6px 14px", background: `${GREEN}10`, borderRadius: 20 }}>
              {subscribedIds.size} abonnement{subscribedIds.size > 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-6 flex" style={{ gap: 6 }}>
          {tabs.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              aria-pressed={tab === t.value}
              className="flex items-center"
              style={{
                fontSize: 12,
                padding: "7px 16px",
                borderRadius: 20,
                gap: 6,
                transition: "background-color 0.15s",
                ...(tab === t.value
                  ? { background: INDIGO, color: CREAM }
                  : { background: black(0.05), color: ink(0.5) }),
              }}
            >
              <span aria-hidden style={{ fontSize: 13 }}>{t.icon}</span>
              {t.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Parcourir ─────────────────────────── */}
        {tab === "parcourir" && (
          <>
            {/* Theme filter chips */}
            <div className="mt-5 flex flex-wrap" style={{ gap: 6 }}>
              <button
                type="button"
                onClick={() => setThemeFilter(null)}
                style={{
                  fontSize: 11,
                  padding: "5px 14px",
                  borderRadius: 20,
                  transition: "background-color 0.15s",
                  ...(themeFilter === null
                    ? { background: INDIGO, color: CREAM }
                    : { background: black(0.05), color: ink(0.5) }),
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
                    fontSize: 11,
                    padding: "5px 14px",
                    borderRadius: 20,
                    transition: "background-color 0.15s",
                    ...(themeFilter === theme
                      ? { background: INDIGO, color: CREAM }
                      : { background: black(0.05), color: ink(0.5) }),
                  }}
                >
                  {theme}
                </button>
              ))}
            </div>

            {/* Sources grid */}
            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
              {filteredSources.map((source) => (
                <PodcastCard
                  key={source.id}
                  source={source}
                  subscribed={subscribedIds.has(source.id)}
                  toggling={toggling.has(source.id)}
                  onToggle={() => handleToggle(source.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* ── Tab: Mes abonnements ──────────────────── */}
        {tab === "abonnements" && (
          <>
            {subs === null ? (
              <div className="mt-6 flex flex-col" style={{ gap: 10 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} className="animate-pulse" style={card}>
                    <div className="flex items-center gap-3">
                      <span style={{ width: 44, height: 44, borderRadius: 12, background: black(0.06) }} />
                      <div className="flex-1">
                        <span className="block" style={{ width: "50%", height: 12, background: black(0.06), borderRadius: 6 }} />
                        <span className="mt-2 block" style={{ width: "70%", height: 10, background: black(0.04), borderRadius: 6 }} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : subscribedSources.length === 0 ? (
              <div className="mt-6 text-center" style={{ ...card, padding: 48 }}>
                <p style={{ fontSize: 28 }}>◎</p>
                <p className="mt-2" style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>Aucun abonnement</p>
                <p className="mx-auto mt-1" style={{ fontSize: 12, color: DIM, maxWidth: 300, lineHeight: 1.5 }}>
                  Explore les podcasts disponibles et abonne-toi à ceux qui t&apos;intéressent.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("parcourir")}
                  className="mt-4 transition hover:brightness-110"
                  style={{ background: INDIGO, color: CREAM, borderRadius: 20, padding: "9px 20px", fontSize: 12, fontWeight: 500 }}
                >
                  Parcourir les podcasts
                </button>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                {subscribedSources.map((source) => (
                  <PodcastCard
                    key={source.id}
                    source={source}
                    subscribed
                    toggling={toggling.has(source.id)}
                    onToggle={() => handleToggle(source.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Info section */}
        <section className="mt-12">
          <div style={{ ...card, background: `${INDIGO}08`, borderColor: `${INDIGO}15` }}>
            <div className="flex items-start gap-3">
              <span style={{ fontSize: 20 }}>✧</span>
              <div>
                <p style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>Comment ça marche ?</p>
                <p className="mt-1" style={{ fontSize: 12, color: DIM, lineHeight: 1.6 }}>
                  Abonne-toi aux podcasts qui t&apos;intéressent pour les retrouver ici et dans ton feed.
                  Clique sur <strong style={{ fontWeight: 500, color: TEXT }}>Spotify</strong> ou{" "}
                  <strong style={{ fontWeight: 500, color: TEXT }}>Apple Podcasts</strong> pour écouter
                  directement les derniers épisodes sur ta plateforme préférée.
                </p>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

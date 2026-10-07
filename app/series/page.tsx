"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import {
  getSeriesGenres,
  getSeriesPlatforms,
  getUserWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  updateWatchlistStatus,
  platformColor,
  SERIES_SOURCES,
  type SeriesSource,
  type SeriesWatchlistItem,
} from "@/lib/series";
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
const GOLD = "#C4A94A";
const YT_RED = "#FF0000";

/* ── Fade-in hook ────────────────────────────────────────────────────── */
function useFadeIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const timer = setTimeout(() => setVisible(true), delay);
    return () => clearTimeout(timer);
  }, [delay]);
  return { ref, style: { opacity: visible ? 1 : 0, transform: visible ? "none" : "translateY(12px)", transition: "opacity 0.5s cubic-bezier(0.16,1,0.3,1), transform 0.5s cubic-bezier(0.16,1,0.3,1)" } as CSSProperties };
}

/* ── Loading skeleton ────────────────────────────────────────────────── */
function CardSkeleton() {
  return (
    <div className="bb-card-flat" style={{ padding: 16 }}>
      <div className="flex items-start gap-3">
        <div className="bb-skeleton" style={{ width: 44, height: 44, borderRadius: 12 }} />
        <div className="flex-1">
          <div className="bb-skeleton" style={{ height: 14, width: "60%", marginBottom: 8 }} />
          <div className="bb-skeleton" style={{ height: 10, width: "90%" }} />
        </div>
      </div>
      <div className="mt-4 flex gap-2">
        <div className="bb-skeleton" style={{ height: 20, width: 60 }} />
        <div className="bb-skeleton" style={{ height: 20, width: 50 }} />
      </div>
    </div>
  );
}

function LoadingGrid() {
  return (
    <div className="mt-5 grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
      {[1,2,3,4].map((i) => <CardSkeleton key={i} />)}
    </div>
  );
}

/* ── Series card ─────────────────────────────────────────────────────── */

const statusLabels: Record<SeriesWatchlistItem["status"], { label: string; icon: string; color: string }> = {
  "à voir": { label: "À voir", icon: "📋", color: INDIGO },
  "en cours": { label: "En cours", icon: "▶️", color: GOLD },
  terminé: { label: "Terminé", icon: "✓", color: GREEN },
};

function SeriesCard({
  source,
  watchItem,
  toggling,
  onAdd,
  onRemove,
  onStatus,
  index,
}: {
  source: SeriesSource;
  watchItem: SeriesWatchlistItem | null;
  toggling: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onStatus: (s: SeriesWatchlistItem["status"]) => void;
  index: number;
}) {
  const [showStatus, setShowStatus] = useState(false);
  const fade = useFadeIn(index * 50);

  return (
    <div ref={fade.ref} style={fade.style}>
      <article className="bb-card flex flex-col" style={{ padding: 16 }}>
        <div className="flex items-start gap-3">
          <span
            className="flex shrink-0 items-center justify-center"
            style={{ width: 44, height: 44, borderRadius: 12, background: `${source.color}12`, fontSize: 22 }}
          >
            {source.icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate" style={{ fontSize: 14, fontWeight: 600, color: TEXT, letterSpacing: "-0.01em" }}>{source.name}</p>
            <p className="mt-0.5" style={{ fontSize: 12, color: DIM, lineHeight: 1.55 }}>{source.description}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center" style={{ gap: 6 }}>
          <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 10, background: `${source.color}12`, color: source.color, fontWeight: 500 }}>
            {source.genre}
          </span>
          <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 10, background: `${platformColor(source.platform)}12`, color: platformColor(source.platform), fontWeight: 500 }}>
            {source.platform}
          </span>
          <span style={{ fontSize: 10, color: DIM }}>
            {source.year} · {source.seasons} saison{source.seasons > 1 ? "s" : ""}
          </span>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center" style={{ gap: 8 }}>
            <a href={source.url} target="_blank" rel="noopener noreferrer" className="truncate transition-colors hover:underline" style={{ fontSize: 11, color: INDIGO, fontWeight: 500 }}>
              ↗ Regarder
            </a>
            {source.trailer_url && (
              <a href={source.trailer_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 transition-colors hover:underline" style={{ fontSize: 11, color: "#C0392B" }}>
                ▶ Bande-annonce
              </a>
            )}
          </div>

          {!watchItem ? (
            <button
              type="button"
              onClick={onAdd}
              disabled={toggling}
              className="bb-btn-primary shrink-0"
              style={{ fontSize: 12, padding: "6px 16px" }}
            >
              {toggling ? "…" : "+ Ma liste"}
            </button>
          ) : (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowStatus((o) => !o)}
                disabled={toggling}
                className="shrink-0 transition-all disabled:opacity-50"
                style={{
                  fontSize: 12, padding: "6px 16px", borderRadius: 20, fontWeight: 500,
                  background: `${statusLabels[watchItem.status].color}14`,
                  color: statusLabels[watchItem.status].color,
                  border: `1px solid ${statusLabels[watchItem.status].color}30`,
                }}
              >
                {toggling ? "…" : `${statusLabels[watchItem.status].icon} ${statusLabels[watchItem.status].label}`}
              </button>
              {showStatus && (
                <div className="absolute right-0 top-9 z-10" style={{ background: WHITE, borderRadius: 12, border: `1px solid ${black(0.08)}`, boxShadow: "0 12px 32px rgba(0,0,0,0.12)", minWidth: 150, overflow: "hidden" }}>
                  {(Object.keys(statusLabels) as SeriesWatchlistItem["status"][]).map((s) => (
                    <button key={s} type="button" onClick={() => { onStatus(s); setShowStatus(false); }} className="block w-full px-4 py-2.5 text-left transition-colors hover:bg-[#F7F4EE]" style={{ fontSize: 12, color: statusLabels[s].color }}>
                      {statusLabels[s].icon} {statusLabels[s].label}
                    </button>
                  ))}
                  <div style={{ height: 1, background: black(0.06) }} />
                  <button type="button" onClick={() => { onRemove(); setShowStatus(false); }} className="block w-full px-4 py-2.5 text-left transition-colors hover:bg-[#F7F4EE]" style={{ fontSize: 12, color: ink(0.4) }}>
                    Retirer de ma liste
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </article>
    </div>
  );
}

/* ── Video card ──────────────────────────────────────────────────────── */

function VideoCard({
  source,
  subscribed,
  toggling,
  onToggle,
  index,
}: {
  source: VideoSource;
  subscribed: boolean;
  toggling: boolean;
  onToggle: () => void;
  index: number;
}) {
  const fade = useFadeIn(index * 50);

  return (
    <div ref={fade.ref} style={fade.style}>
      <article className="bb-card flex flex-col" style={{ overflow: "hidden" }}>
        <a
          href={source.channel_url}
          target="_blank"
          rel="noopener noreferrer"
          className="relative block transition-all hover:brightness-105"
          style={{ aspectRatio: "16/9", background: `linear-gradient(135deg, ${source.color}18, ${source.color}35)` }}
        >
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5">
            <span style={{ fontSize: 42 }}>{source.icon}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: TEXT, letterSpacing: "-0.01em" }}>{source.name}</span>
            <span className="flex items-center gap-1.5" style={{ fontSize: 11, padding: "5px 14px", borderRadius: 20, background: "rgba(255,0,0,0.88)", color: WHITE, fontWeight: 500 }}>
              ▶ Voir sur YouTube
            </span>
          </div>
        </a>

        <div style={{ padding: 16 }}>
          <div className="flex items-start gap-3">
            <span className="flex shrink-0 items-center justify-center" style={{ width: 36, height: 36, borderRadius: 10, background: `${source.color}12`, fontSize: 18 }}>
              {source.icon}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate" style={{ fontSize: 14, fontWeight: 600, color: TEXT, letterSpacing: "-0.01em" }}>{source.name}</p>
              <p className="mt-0.5" style={{ fontSize: 12, color: DIM, lineHeight: 1.55 }}>{source.description}</p>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <div className="flex items-center" style={{ gap: 8 }}>
              <span style={{ fontSize: 10, padding: "3px 10px", borderRadius: 10, background: `${source.color}12`, color: source.color, fontWeight: 500 }}>
                {source.theme}
              </span>
              <a href={source.channel_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 transition-colors hover:underline" style={{ fontSize: 11, color: YT_RED, fontWeight: 500 }}>
                <span style={{ fontSize: 10 }}>●</span> YouTube
              </a>
            </div>

            <button
              type="button"
              onClick={onToggle}
              disabled={toggling}
              className="shrink-0 transition-all disabled:opacity-50"
              style={{
                fontSize: 12, padding: "6px 16px", borderRadius: 20, fontWeight: 500,
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
    </div>
  );
}

/* ── Main page ───────────────────────────────────────────────────────── */

type Section = "series" | "videos";
type SeriesTab = "parcourir" | "maliste";
type VideoTab = "parcourir" | "abonnements";

export default function SeriesAndVideos() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [ready, setReady] = useState(false);

  const [section, setSection] = useState<Section>("series");
  const [seriesTab, setSeriesTab] = useState<SeriesTab>("parcourir");
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<SeriesWatchlistItem[] | null>(null);
  const [sToggling, setSToggling] = useState<Set<string>>(new Set());

  const [videoTab, setVideoTab] = useState<VideoTab>("parcourir");
  const [themeFilter, setThemeFilter] = useState<string | null>(null);
  const [subs, setSubs] = useState<VideoSubscription[] | null>(null);
  const [vToggling, setVToggling] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setSession(data.session);
      setTimeout(() => setReady(true), 50);
    });
  }, [router]);

  const userId = session?.user.id;

  const loadWatchlist = useCallback(async () => {
    if (!userId) return;
    setWatchlist(await getUserWatchlist(userId));
  }, [userId]);

  const loadSubs = useCallback(async () => {
    if (!userId) return;
    setSubs(await getUserVideoSubscriptions(userId));
  }, [userId]);

  useEffect(() => { loadWatchlist(); }, [loadWatchlist]);
  useEffect(() => { loadSubs(); }, [loadSubs]);

  const watchMap = new Map((watchlist ?? []).map((w) => [w.series_id, w]));
  const subscribedIds = new Set((subs ?? []).map((s) => s.source_id));

  // Series handlers
  const handleAdd = async (seriesId: string) => {
    if (!userId) return;
    setSToggling((p) => new Set(p).add(seriesId));
    await addToWatchlist(userId, seriesId);
    await loadWatchlist();
    setSToggling((p) => { const n = new Set(p); n.delete(seriesId); return n; });
  };
  const handleRemove = async (seriesId: string) => {
    if (!userId) return;
    setSToggling((p) => new Set(p).add(seriesId));
    await removeFromWatchlist(userId, seriesId);
    await loadWatchlist();
    setSToggling((p) => { const n = new Set(p); n.delete(seriesId); return n; });
  };
  const handleStatus = async (seriesId: string, status: SeriesWatchlistItem["status"]) => {
    if (!userId) return;
    setSToggling((p) => new Set(p).add(seriesId));
    await updateWatchlistStatus(userId, seriesId, status);
    await loadWatchlist();
    setSToggling((p) => { const n = new Set(p); n.delete(seriesId); return n; });
  };

  // Video handlers
  const handleVideoToggle = async (sourceId: string) => {
    if (!userId) return;
    setVToggling((p) => new Set(p).add(sourceId));
    if (subscribedIds.has(sourceId)) await unsubscribeVideo(userId, sourceId);
    else await subscribeVideo(userId, sourceId);
    await loadSubs();
    setVToggling((p) => { const n = new Set(p); n.delete(sourceId); return n; });
  };

  if (!session) return <div className="min-h-screen" style={{ background: CREAM }} />;

  const genres = getSeriesGenres();
  const platforms = getSeriesPlatforms();
  let filteredSeries = SERIES_SOURCES;
  if (genreFilter) filteredSeries = filteredSeries.filter((s) => s.genre === genreFilter);
  if (platformFilter) filteredSeries = filteredSeries.filter((s) => s.platform === platformFilter);
  const myListSources = SERIES_SOURCES.filter((s) => watchMap.has(s.id));

  const themes = getVideoThemes();
  const filteredVideos = themeFilter ? VIDEO_SOURCES.filter((s) => s.theme === themeFilter) : VIDEO_SOURCES;
  const subscribedSources = VIDEO_SOURCES.filter((s) => subscribedIds.has(s.id));

  const seriesCount = watchMap.size;
  const videoCount = subscribedIds.size;

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: TEXT }}>
      <Navbar />
      <main className={`mx-auto px-4 sm:px-6 ${ready ? "page-enter" : ""}`} style={{ maxWidth: 800, paddingBlock: 32 }}>
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 style={{ fontFamily: GEORGIA, fontSize: 28, fontWeight: 400, color: TEXT, letterSpacing: "-0.5px" }}>Séries & Vidéos</h1>
            <p className="mt-1.5" style={{ fontSize: 13, color: DIM }}>Séries françaises et chaînes YouTube culturelles</p>
          </div>
          <div className="flex items-center gap-2">
            {seriesCount > 0 && (
              <span style={{ fontSize: 11, color: INDIGO, fontWeight: 500, padding: "5px 12px", background: `${INDIGO}08`, borderRadius: 20, border: `1px solid ${INDIGO}15` }}>
                {seriesCount} série{seriesCount > 1 ? "s" : ""}
              </span>
            )}
            {videoCount > 0 && (
              <span style={{ fontSize: 11, color: YT_RED, fontWeight: 500, padding: "5px 12px", background: `${YT_RED}08`, borderRadius: 20, border: `1px solid ${YT_RED}15` }}>
                {videoCount} chaîne{videoCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>

        {/* Section toggle */}
        <div className="bb-segmented mt-6">
          {([
            { value: "series" as Section, label: "Séries", icon: "🎬" },
            { value: "videos" as Section, label: "Vidéos YouTube", icon: "▶️" },
          ]).map((s) => (
            <button
              key={s.value}
              type="button"
              onClick={() => setSection(s.value)}
              className={section === s.value ? "active" : "inactive"}
            >
              <span aria-hidden style={{ fontSize: 14 }}>{s.icon}</span>
              {s.label}
            </button>
          ))}
        </div>

        {/* ════════ SÉRIES ════════ */}
        {section === "series" && (
          <>
            <div className="mt-5 flex" style={{ gap: 6 }}>
              {([
                { value: "parcourir" as SeriesTab, label: "Parcourir", icon: "🔍" },
                { value: "maliste" as SeriesTab, label: "Ma liste", icon: "📋" },
              ]).map((t) => (
                <button key={t.value} type="button" onClick={() => setSeriesTab(t.value)}
                  className={`bb-chip ${seriesTab === t.value ? "bb-chip-active" : "bb-chip-inactive"}`} style={{ gap: 6 }}>
                  <span aria-hidden style={{ fontSize: 13 }}>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>

            {seriesTab === "parcourir" && (
              <>
                <div className="mt-5 flex flex-wrap" style={{ gap: 6 }}>
                  <button type="button" onClick={() => { setGenreFilter(null); setPlatformFilter(null); }}
                    className={`bb-chip ${!genreFilter && !platformFilter ? "bb-chip-active" : "bb-chip-inactive"}`}>
                    Tous
                  </button>
                  {genres.map((g) => (
                    <button key={g} type="button" onClick={() => { setGenreFilter(genreFilter === g ? null : g); setPlatformFilter(null); }}
                      className={`bb-chip ${genreFilter === g ? "bb-chip-active" : "bb-chip-inactive"}`}>
                      {g}
                    </button>
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap" style={{ gap: 6 }}>
                  {platforms.map((p) => (
                    <button key={p} type="button" onClick={() => { setPlatformFilter(platformFilter === p ? null : p); setGenreFilter(null); }}
                      className="bb-chip" style={{
                        fontSize: 10, padding: "4px 12px", fontWeight: 500,
                        ...(platformFilter === p
                          ? { background: platformColor(p as SeriesSource["platform"]), color: WHITE }
                          : { background: black(0.03), color: ink(0.4) }),
                      }}>
                      {p}
                    </button>
                  ))}
                </div>

                {watchlist === null ? <LoadingGrid /> : (
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                    {filteredSeries.map((source, i) => (
                      <SeriesCard key={source.id} source={source} watchItem={watchMap.get(source.id) ?? null} toggling={sToggling.has(source.id)}
                        onAdd={() => handleAdd(source.id)} onRemove={() => handleRemove(source.id)} onStatus={(s) => handleStatus(source.id, s)} index={i} />
                    ))}
                  </div>
                )}
              </>
            )}

            {seriesTab === "maliste" && (
              <>
                {myListSources.length === 0 ? (
                  <div className="mt-8 text-center animate-fade-up" style={{ background: WHITE, border: `1px solid ${black(0.06)}`, borderRadius: 16, padding: "56px 24px" }}>
                    <p style={{ fontSize: 36 }}>📺</p>
                    <p className="mt-3" style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Ta liste est vide</p>
                    <p className="mx-auto mt-1.5" style={{ fontSize: 13, color: DIM, maxWidth: 300, lineHeight: 1.6 }}>
                      Parcours les séries et ajoute celles qui te tentent à ta liste.
                    </p>
                    <button type="button" onClick={() => setSeriesTab("parcourir")} className="bb-btn-primary mt-5">
                      Parcourir les séries
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                    {myListSources.map((source, i) => (
                      <SeriesCard key={source.id} source={source} watchItem={watchMap.get(source.id) ?? null} toggling={sToggling.has(source.id)}
                        onAdd={() => handleAdd(source.id)} onRemove={() => handleRemove(source.id)} onStatus={(s) => handleStatus(source.id, s)} index={i} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ════════ VIDÉOS ════════ */}
        {section === "videos" && (
          <>
            <div className="mt-5 flex" style={{ gap: 6 }}>
              {([
                { value: "parcourir" as VideoTab, label: "Parcourir", icon: "🔍" },
                { value: "abonnements" as VideoTab, label: "Mes chaînes", icon: "📺" },
              ]).map((t) => (
                <button key={t.value} type="button" onClick={() => setVideoTab(t.value)}
                  className={`bb-chip ${videoTab === t.value ? "bb-chip-active" : "bb-chip-inactive"}`} style={{ gap: 6 }}>
                  <span aria-hidden style={{ fontSize: 13 }}>{t.icon}</span>{t.label}
                </button>
              ))}
            </div>

            {videoTab === "parcourir" && (
              <>
                <div className="mt-5 flex flex-wrap" style={{ gap: 6 }}>
                  <button type="button" onClick={() => setThemeFilter(null)}
                    className={`bb-chip ${themeFilter === null ? "bb-chip-active" : "bb-chip-inactive"}`}>
                    Tous
                  </button>
                  {themes.map((theme) => (
                    <button key={theme} type="button" onClick={() => setThemeFilter(themeFilter === theme ? null : theme)}
                      className={`bb-chip ${themeFilter === theme ? "bb-chip-active" : "bb-chip-inactive"}`}>
                      {theme}
                    </button>
                  ))}
                </div>

                {subs === null ? <LoadingGrid /> : (
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                    {filteredVideos.map((source, i) => (
                      <VideoCard key={source.id} source={source} subscribed={subscribedIds.has(source.id)} toggling={vToggling.has(source.id)} onToggle={() => handleVideoToggle(source.id)} index={i} />
                    ))}
                  </div>
                )}
              </>
            )}

            {videoTab === "abonnements" && (
              <>
                {subscribedSources.length === 0 ? (
                  <div className="mt-8 text-center animate-fade-up" style={{ background: WHITE, border: `1px solid ${black(0.06)}`, borderRadius: 16, padding: "56px 24px" }}>
                    <p style={{ fontSize: 36 }}>📺</p>
                    <p className="mt-3" style={{ fontSize: 15, fontWeight: 600, color: TEXT }}>Aucune chaîne suivie</p>
                    <p className="mx-auto mt-1.5" style={{ fontSize: 13, color: DIM, maxWidth: 300, lineHeight: 1.6 }}>
                      Découvre les chaînes YouTube culturelles et suis celles qui te plaisent.
                    </p>
                    <button type="button" onClick={() => setVideoTab("parcourir")} className="bb-btn-primary mt-5">
                      Parcourir les chaînes
                    </button>
                  </div>
                ) : (
                  <div className="mt-5 grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                    {subscribedSources.map((source, i) => (
                      <VideoCard key={source.id} source={source} subscribed toggling={vToggling.has(source.id)} onToggle={() => handleVideoToggle(source.id)} index={i} />
                    ))}
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

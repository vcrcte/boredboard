"use client";

import { useCallback, useEffect, useState, type CSSProperties } from "react";
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

const card: CSSProperties = {
  background: WHITE,
  border: `1px solid ${black(0.07)}`,
  borderRadius: 14,
  padding: 16,
};

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
}: {
  source: SeriesSource;
  watchItem: SeriesWatchlistItem | null;
  toggling: boolean;
  onAdd: () => void;
  onRemove: () => void;
  onStatus: (s: SeriesWatchlistItem["status"]) => void;
}) {
  const [showStatus, setShowStatus] = useState(false);

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

      <div className="mt-3 flex flex-wrap items-center" style={{ gap: 6 }}>
        <span
          style={{
            fontSize: 10,
            padding: "3px 10px",
            borderRadius: 10,
            background: `${source.color}12`,
            color: source.color,
          }}
        >
          {source.genre}
        </span>
        <span
          style={{
            fontSize: 10,
            padding: "3px 10px",
            borderRadius: 10,
            background: `${platformColor(source.platform)}12`,
            color: platformColor(source.platform),
          }}
        >
          {source.platform}
        </span>
        <span style={{ fontSize: 10, color: DIM }}>
          {source.year} · {source.seasons} saison{source.seasons > 1 ? "s" : ""}
        </span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <div className="flex items-center" style={{ gap: 8 }}>
          <a
            href={source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate transition hover:underline"
            style={{ fontSize: 11, color: INDIGO }}
          >
            ↗ Regarder
          </a>
          {source.trailer_url && (
            <a
              href={source.trailer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 transition hover:underline"
              style={{ fontSize: 11, color: "#C0392B" }}
            >
              ▶ Bande-annonce
            </a>
          )}
        </div>

        {!watchItem ? (
          <button
            type="button"
            onClick={onAdd}
            disabled={toggling}
            className="shrink-0 transition disabled:opacity-50"
            style={{ fontSize: 12, padding: "6px 16px", borderRadius: 20, fontWeight: 500, background: INDIGO, color: CREAM }}
          >
            {toggling ? "…" : "+ Ma liste"}
          </button>
        ) : (
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowStatus((o) => !o)}
              disabled={toggling}
              className="shrink-0 transition disabled:opacity-50"
              style={{
                fontSize: 12,
                padding: "6px 16px",
                borderRadius: 20,
                fontWeight: 500,
                background: `${statusLabels[watchItem.status].color}14`,
                color: statusLabels[watchItem.status].color,
                border: `1px solid ${statusLabels[watchItem.status].color}30`,
              }}
            >
              {toggling ? "…" : `${statusLabels[watchItem.status].icon} ${statusLabels[watchItem.status].label}`}
            </button>
            {showStatus && (
              <div
                className="absolute right-0 top-9 z-10"
                style={{
                  background: WHITE,
                  borderRadius: 10,
                  border: `1px solid ${black(0.08)}`,
                  boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                  minWidth: 140,
                }}
              >
                {(Object.keys(statusLabels) as SeriesWatchlistItem["status"][]).map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => { onStatus(s); setShowStatus(false); }}
                    className="block w-full px-3 py-2 text-left transition hover:bg-[#F7F4EE]"
                    style={{ fontSize: 12, color: statusLabels[s].color }}
                  >
                    {statusLabels[s].icon} {statusLabels[s].label}
                  </button>
                ))}
                <div style={{ height: 1, background: black(0.06) }} />
                <button
                  type="button"
                  onClick={() => { onRemove(); setShowStatus(false); }}
                  className="block w-full px-3 py-2 text-left transition hover:bg-[#F7F4EE]"
                  style={{ fontSize: 12, color: ink(0.4) }}
                >
                  Retirer de ma liste
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
  );
}

type Tab = "parcourir" | "maliste";

export default function Series() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tab, setTab] = useState<Tab>("parcourir");
  const [genreFilter, setGenreFilter] = useState<string | null>(null);
  const [platformFilter, setPlatformFilter] = useState<string | null>(null);
  const [watchlist, setWatchlist] = useState<SeriesWatchlistItem[] | null>(null);
  const [toggling, setToggling] = useState<Set<string>>(new Set());

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) { router.replace("/login"); return; }
      setSession(data.session);
    });
  }, [router]);

  const userId = session?.user.id;

  const loadWatchlist = useCallback(async () => {
    if (!userId) return;
    const list = await getUserWatchlist(userId);
    setWatchlist(list);
  }, [userId]);

  useEffect(() => { loadWatchlist(); }, [loadWatchlist]);

  const watchMap = new Map((watchlist ?? []).map((w) => [w.series_id, w]));

  const handleAdd = async (seriesId: string) => {
    if (!userId) return;
    setToggling((prev) => new Set(prev).add(seriesId));
    await addToWatchlist(userId, seriesId);
    await loadWatchlist();
    setToggling((prev) => { const next = new Set(prev); next.delete(seriesId); return next; });
  };

  const handleRemove = async (seriesId: string) => {
    if (!userId) return;
    setToggling((prev) => new Set(prev).add(seriesId));
    await removeFromWatchlist(userId, seriesId);
    await loadWatchlist();
    setToggling((prev) => { const next = new Set(prev); next.delete(seriesId); return next; });
  };

  const handleStatus = async (seriesId: string, status: SeriesWatchlistItem["status"]) => {
    if (!userId) return;
    setToggling((prev) => new Set(prev).add(seriesId));
    await updateWatchlistStatus(userId, seriesId, status);
    await loadWatchlist();
    setToggling((prev) => { const next = new Set(prev); next.delete(seriesId); return next; });
  };

  if (!session) return <div className="min-h-screen" style={{ background: CREAM }} />;

  const genres = getSeriesGenres();
  const platforms = getSeriesPlatforms();

  let filtered = SERIES_SOURCES;
  if (genreFilter) filtered = filtered.filter((s) => s.genre === genreFilter);
  if (platformFilter) filtered = filtered.filter((s) => s.platform === platformFilter);

  const myListSources = SERIES_SOURCES.filter((s) => watchMap.has(s.id));

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <Navbar />
      <main className="mx-auto px-4 sm:px-6" style={{ maxWidth: 800, paddingBlock: 32 }}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 style={{ fontFamily: GEORGIA, fontSize: 28, fontWeight: 400, color: TEXT }}>Séries</h1>
            <p className="mt-1" style={{ fontSize: 13, color: DIM }}>Les meilleures séries françaises à binger</p>
          </div>
          {watchMap.size > 0 && (
            <span style={{ fontSize: 12, color: INDIGO, fontWeight: 500, padding: "6px 14px", background: `${INDIGO}10`, borderRadius: 20 }}>
              {watchMap.size} dans ma liste
            </span>
          )}
        </div>

        <div className="mt-6 flex" style={{ gap: 6 }}>
          {([
            { value: "parcourir" as Tab, label: "Parcourir", icon: "🔍" },
            { value: "maliste" as Tab, label: "Ma liste", icon: "📋" },
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
                onClick={() => { setGenreFilter(null); setPlatformFilter(null); }}
                style={{
                  fontSize: 11, padding: "5px 14px", borderRadius: 20,
                  ...(!genreFilter && !platformFilter ? { background: INDIGO, color: CREAM } : { background: black(0.05), color: ink(0.5) }),
                }}
              >
                Tous
              </button>
              {genres.map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => { setGenreFilter(genreFilter === g ? null : g); setPlatformFilter(null); }}
                  style={{
                    fontSize: 11, padding: "5px 14px", borderRadius: 20,
                    ...(genreFilter === g ? { background: INDIGO, color: CREAM } : { background: black(0.05), color: ink(0.5) }),
                  }}
                >
                  {g}
                </button>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap" style={{ gap: 6 }}>
              {platforms.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { setPlatformFilter(platformFilter === p ? null : p); setGenreFilter(null); }}
                  style={{
                    fontSize: 10, padding: "4px 12px", borderRadius: 20, fontWeight: 500,
                    ...(platformFilter === p
                      ? { background: platformColor(p as SeriesSource["platform"]), color: WHITE }
                      : { background: black(0.03), color: ink(0.4) }),
                  }}
                >
                  {p}
                </button>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
              {filtered.map((source) => (
                <SeriesCard
                  key={source.id}
                  source={source}
                  watchItem={watchMap.get(source.id) ?? null}
                  toggling={toggling.has(source.id)}
                  onAdd={() => handleAdd(source.id)}
                  onRemove={() => handleRemove(source.id)}
                  onStatus={(s) => handleStatus(source.id, s)}
                />
              ))}
            </div>
          </>
        )}

        {tab === "maliste" && (
          <>
            {myListSources.length === 0 ? (
              <div className="mt-6 text-center" style={{ ...card, padding: 48 }}>
                <p style={{ fontSize: 28 }}>📺</p>
                <p className="mt-2" style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>Ta liste est vide</p>
                <p className="mx-auto mt-1" style={{ fontSize: 12, color: DIM, maxWidth: 300, lineHeight: 1.5 }}>
                  Parcours les séries et ajoute celles qui te tentent à ta liste.
                </p>
                <button
                  type="button"
                  onClick={() => setTab("parcourir")}
                  className="mt-4 transition hover:brightness-110"
                  style={{ background: INDIGO, color: CREAM, borderRadius: 20, padding: "9px 20px", fontSize: 12, fontWeight: 500 }}
                >
                  Parcourir les séries
                </button>
              </div>
            ) : (
              <div className="mt-5 grid grid-cols-1 sm:grid-cols-2" style={{ gap: 12 }}>
                {myListSources.map((source) => (
                  <SeriesCard
                    key={source.id}
                    source={source}
                    watchItem={watchMap.get(source.id) ?? null}
                    toggling={toggling.has(source.id)}
                    onAdd={() => handleAdd(source.id)}
                    onRemove={() => handleRemove(source.id)}
                    onStatus={(s) => handleStatus(source.id, s)}
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

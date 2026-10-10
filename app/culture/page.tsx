"use client";

import { useEffect, useState, useCallback } from "react";
import Navbar from "@/components/Navbar";

// ── Theme ────────────────────────────────────────────────────────────────
const LIGHT = { cream: "#F7F4EE", surface: "#F0EBE1", white: "#FFFFFF", text: "#1C1A15", textMuted: "rgba(28,26,21,0.5)", indigo: "#2A3560", gold: "#C4A94A", border: "rgba(0,0,0,0.06)", cardShadow: "0 2px 12px rgba(0,0,0,0.04)" };
const DARK  = { cream: "#1A1A2E", surface: "#16213E", white: "#1E1E30", text: "#E8E6E1", textMuted: "rgba(232,230,225,0.5)", indigo: "#7B8CDE", gold: "#C4A94A", border: "rgba(255,255,255,0.08)", cardShadow: "0 2px 12px rgba(0,0,0,0.2)" };

function useTheme() {
  const [t, setT] = useState(LIGHT);
  useEffect(() => {
    const apply = () => setT(document.documentElement.getAttribute("data-theme") === "dark" ? DARK : LIGHT);
    apply();
    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return t;
}

// ── Types ────────────────────────────────────────────────────────────────
type WikiItem = {
  type: "wikipedia" | "ephemeride";
  title: string;
  summary: string;
  image: string | null;
  url: string | null;
  source: string;
  category: string;
  year?: number;
};

type BookItem = {
  type: "book";
  title: string;
  author: string;
  year: number | null;
  cover: string | null;
  url: string;
  subjects: string[];
};

type MediaLink = {
  name: string;
  url: string;
  description: string;
  icon: string;
};

type FeedData = {
  date: string;
  featured: WikiItem | null;
  onThisDay: WikiItem[];
  mostRead: WikiItem[];
  books: BookItem[];
  media: MediaLink[];
};

// ── Skeleton ─────────────────────────────────────────────────────────────
function Skeleton({ w = "100%", h = 16 }: { w?: string | number; h?: number }) {
  return <div style={{ width: w, height: h, borderRadius: 8, background: "rgba(128,128,128,0.1)", animation: "pulse 1.5s ease-in-out infinite" }} />;
}

// ── Page ─────────────────────────────────────────────────────────────────
export default function CulturePage() {
  const t = useTheme();
  const [feed, setFeed] = useState<FeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"decouvrir" | "livres" | "medias">("decouvrir");

  const fetchFeed = useCallback(async () => {
    try {
      const res = await fetch("/api/culture/feed");
      if (!res.ok) throw new Error("fetch failed");
      const data = await res.json();
      setFeed(data);
    } catch { /* no-op */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchFeed(); }, [fetchFeed]);

  const card: React.CSSProperties = { background: t.white, borderRadius: 14, border: `1px solid ${t.border}`, boxShadow: t.cardShadow };
  const DIM = t.textMuted;

  return (
    <div style={{ minHeight: "100vh", background: t.cream }}>
      <Navbar />
      <style>{`@keyframes pulse { 0%,100% { opacity: 0.4 } 50% { opacity: 0.8 } }`}</style>

      <main style={{ maxWidth: 960, margin: "0 auto", padding: "28px 16px 80px" }}>

        {/* ── Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: t.text, fontFamily: "'Georgia', serif", marginBottom: 4 }}>
            Culture
          </h1>
          {feed && (
            <p style={{ fontSize: 13, color: DIM, textTransform: "capitalize" }}>{feed.date}</p>
          )}
        </div>

        {/* ── Tabs */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, borderBottom: `1px solid ${t.border}`, paddingBottom: 1 }}>
          {([
            { key: "decouvrir" as const, label: "Découvrir" },
            { key: "livres" as const, label: "Livres" },
            { key: "medias" as const, label: "Médias" },
          ]).map(tab => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              style={{
                background: "none", border: "none", cursor: "pointer",
                padding: "8px 16px", fontSize: 13, fontWeight: activeTab === tab.key ? 600 : 400,
                color: activeTab === tab.key ? t.indigo : DIM,
                borderBottom: activeTab === tab.key ? `2px solid ${t.indigo}` : "2px solid transparent",
                marginBottom: -1, transition: "all 0.15s ease",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Loading */}
        {loading && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {[1,2,3].map(i => (
              <div key={i} style={{ ...card, padding: 24 }}>
                <Skeleton w="60%" h={20} />
                <div style={{ marginTop: 12 }}><Skeleton w="100%" h={14} /></div>
                <div style={{ marginTop: 8 }}><Skeleton w="80%" h={14} /></div>
              </div>
            ))}
          </div>
        )}

        {/* ── Tab: Découvrir */}
        {!loading && activeTab === "decouvrir" && feed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

            {/* Article du jour Wikipedia */}
            {feed.featured && (
              <a
                href={feed.featured.url ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                style={{ ...card, padding: 0, overflow: "hidden", textDecoration: "none", color: "inherit", display: "block", transition: "transform 0.2s ease" }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
              >
                {feed.featured.image && (
                  <div style={{ width: "100%", height: 200, overflow: "hidden" }}>
                    <img src={feed.featured.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                )}
                <div style={{ padding: "20px 24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: t.gold, textTransform: "uppercase", letterSpacing: 1.5 }}>
                      ✦ Article du jour
                    </span>
                    <span style={{ fontSize: 11, color: DIM }}>— Wikipedia</span>
                  </div>
                  <h2 style={{ fontSize: 22, fontWeight: 700, color: t.text, lineHeight: 1.3, fontFamily: "'Georgia', serif", margin: 0 }}>
                    {feed.featured.title}
                  </h2>
                  <p style={{ fontSize: 14, color: DIM, lineHeight: 1.7, marginTop: 10, marginBottom: 0 }}>
                    {feed.featured.summary}
                  </p>
                </div>
              </a>
            )}

            {/* Éphémérides */}
            {feed.onThisDay.length > 0 && (
              <div style={{ ...card, padding: "20px 24px" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: t.gold }}>◈</span> Ce jour dans l&apos;histoire
                </h3>
                <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
                  {feed.onThisDay.map((ev, i) => (
                    <div key={i} style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderTop: i > 0 ? `1px solid ${t.border}` : "none" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: t.indigo, minWidth: 44, fontFamily: "'Georgia', serif" }}>
                        {ev.year}
                      </span>
                      <div style={{ flex: 1 }}>
                        <p style={{ fontSize: 13, color: t.text, lineHeight: 1.6, margin: 0 }}>{ev.title}</p>
                        {ev.url && (
                          <a href={ev.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: t.indigo, textDecoration: "none", marginTop: 4, display: "inline-block" }}>
                            En savoir plus →
                          </a>
                        )}
                      </div>
                      {ev.image && (
                        <img src={ev.image} alt="" style={{ width: 48, height: 48, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Articles tendance Wikipedia */}
            {feed.mostRead.length > 0 && (
              <div style={{ ...card, padding: "20px 24px" }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: t.text, marginBottom: 16, display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ color: t.gold }}>↗</span> Les plus lus sur Wikipedia
                </h3>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
                  {feed.mostRead.map((article, i) => (
                    <a
                      key={i}
                      href={article.url ?? "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        display: "flex", gap: 12, alignItems: "center",
                        padding: 12, borderRadius: 10, textDecoration: "none", color: "inherit",
                        background: t.cream, transition: "background 0.15s ease",
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = t.surface)}
                      onMouseLeave={e => (e.currentTarget.style.background = t.cream)}
                    >
                      {article.image ? (
                        <img src={article.image} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: "cover", flexShrink: 0 }} />
                      ) : (
                        <div style={{ width: 44, height: 44, borderRadius: 8, background: `${t.indigo}10`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 18, color: t.indigo }}>◎</div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: 600, color: t.text, margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{article.title}</p>
                        {article.summary && (
                          <p style={{ fontSize: 11, color: DIM, margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{article.summary.slice(0, 80)}</p>
                        )}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Tab: Livres */}
        {!loading && activeTab === "livres" && feed && (
          <div>
            {feed.books.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 16 }}>
                {feed.books.map((book, i) => (
                  <a
                    key={i}
                    href={book.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ ...card, padding: 0, overflow: "hidden", textDecoration: "none", color: "inherit", transition: "transform 0.2s ease" }}
                    onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-2px)")}
                    onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}
                  >
                    <div style={{ height: 180, background: t.surface, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
                      {book.cover ? (
                        <img src={book.cover} alt="" style={{ height: "100%", objectFit: "contain" }} />
                      ) : (
                        <span style={{ fontSize: 48, opacity: 0.2 }}>📕</span>
                      )}
                    </div>
                    <div style={{ padding: "14px 16px" }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: 0, lineHeight: 1.3, overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" as const }}>
                        {book.title}
                      </h4>
                      <p style={{ fontSize: 12, color: DIM, margin: "6px 0 0" }}>
                        {book.author}{book.year ? ` · ${book.year}` : ""}
                      </p>
                      {book.subjects.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                          {book.subjects.slice(0, 2).map(s => (
                            <span key={s} style={{ fontSize: 10, padding: "2px 8px", borderRadius: 10, background: `${t.indigo}10`, color: t.indigo }}>{s}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <div style={{ ...card, padding: 40, textAlign: "center" }}>
                <p style={{ fontSize: 14, color: DIM }}>Aucun livre trouvé pour le moment.</p>
              </div>
            )}
            <p style={{ fontSize: 11, color: DIM, marginTop: 16, textAlign: "center" }}>
              Données : <a href="https://openlibrary.org" target="_blank" rel="noopener noreferrer" style={{ color: t.indigo, textDecoration: "none" }}>Open Library</a> — le sujet change chaque jour
            </p>
          </div>
        )}

        {/* ── Tab: Médias */}
        {!loading && activeTab === "medias" && feed && (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <p style={{ fontSize: 13, color: DIM, marginBottom: 8, lineHeight: 1.6 }}>
              Une sélection de sources fiables pour explorer la culture, les idées et le savoir au quotidien.
            </p>
            {feed.media.map((m, i) => (
              <a
                key={i}
                href={m.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  ...card, padding: "16px 20px", textDecoration: "none", color: "inherit",
                  display: "flex", alignItems: "center", gap: 16, transition: "transform 0.15s ease",
                }}
                onMouseEnter={e => (e.currentTarget.style.transform = "translateX(4px)")}
                onMouseLeave={e => (e.currentTarget.style.transform = "translateX(0)")}
              >
                <span style={{ fontSize: 22, width: 40, textAlign: "center", flexShrink: 0 }}>{m.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <h4 style={{ fontSize: 14, fontWeight: 600, color: t.text, margin: 0 }}>{m.name}</h4>
                  <p style={{ fontSize: 12, color: DIM, margin: "3px 0 0" }}>{m.description}</p>
                </div>
                <span style={{ marginLeft: "auto", fontSize: 14, color: DIM, flexShrink: 0 }}>→</span>
              </a>
            ))}
          </div>
        )}

        {/* ── Empty feed fallback */}
        {!loading && !feed && (
          <div style={{ ...card, padding: 40, textAlign: "center" }}>
            <p style={{ fontSize: 16, color: t.text, marginBottom: 8 }}>Impossible de charger le contenu</p>
            <p style={{ fontSize: 13, color: DIM, marginBottom: 16 }}>Vérifie ta connexion et réessaie.</p>
            <button
              type="button"
              onClick={() => { setLoading(true); fetchFeed(); }}
              style={{ background: t.indigo, color: "#fff", border: "none", borderRadius: 10, padding: "8px 20px", fontSize: 13, cursor: "pointer", fontWeight: 500 }}
            >
              Réessayer
            </button>
          </div>
        )}

      </main>
    </div>
  );
}

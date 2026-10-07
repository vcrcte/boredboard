"use client";

import { useEffect, useState, useCallback, useRef } from "react";
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
type Topic = {
  id: string;
  title: string;
  slug: string;
  summary: string;
  content: string;
  category: string;
  image_url: string | null;
  source_url: string | null;
  source_name: string | null;
  fun_fact: string | null;
  tags: string[] | null;
  publish_date: string;
  reading_time_min: number;
  difficulty: string;
  likes_count: number;
  views_count: number;
};

// ── Category config ──────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<string, string> = {
  Philosophie: "\u{1F9D0}",
  Science: "\u{1F52C}",
  Art: "\u{1F3A8}",
  Histoire: "\u{1F3DB}",
  "Littérature": "\u{1F4DA}",
  Musique: "\u{1F3B5}",
  "Cinéma": "\u{1F3AC}",
  "Géographie": "\u{1F30D}",
  Psychologie: "\u{1F9E0}",
  Technologie: "\u{1F4BB}",
};

const CATEGORY_COLORS: Record<string, string> = {
  Philosophie: "#8B5CF6",
  Science: "#3B82F6",
  Art: "#EC4899",
  Histoire: "#F59E0B",
  "Littérature": "#10B981",
  Musique: "#6366F1",
  "Cinéma": "#EF4444",
  "Géographie": "#14B8A6",
  Psychologie: "#A855F7",
  Technologie: "#06B6D4",
};

const DIFFICULTY_LABEL: Record<string, string> = {
  accessible: "Accessible",
  "intermédiaire": "Intermédiaire",
  "avancé": "Avancé",
};

// ── Fade-in animation ────────────────────────────────────────────────────
function useFadeIn(delay = 0) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setTimeout(() => setVisible(true), delay); obs.unobserve(el); } }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return { ref, style: { opacity: visible ? 1 : 0, transform: visible ? "translateY(0)" : "translateY(20px)", transition: "opacity 0.6s ease, transform 0.6s ease" } };
}

function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const { ref, style } = useFadeIn(delay);
  return <div ref={ref} style={style} className={className}>{children}</div>;
}

// ── Markdown-lite renderer ───────────────────────────────────────────────
function renderMarkdown(md: string, t: typeof LIGHT) {
  const lines = md.split("\n");
  const elements: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith("## ")) {
      elements.push(<h2 key={key++} style={{ fontSize: 22, fontWeight: 700, color: t.text, marginTop: 32, marginBottom: 12, fontFamily: "'Georgia', serif" }}>{line.slice(3)}</h2>);
      i++;
      continue;
    }

    if (line.startsWith("- ")) {
      const items: string[] = [];
      while (i < lines.length && lines[i].startsWith("- ")) {
        items.push(lines[i].slice(2));
        i++;
      }
      elements.push(
        <ul key={key++} style={{ margin: "12px 0", paddingLeft: 24 }}>
          {items.map((item, j) => (
            <li key={j} style={{ fontSize: 15, lineHeight: 1.7, color: t.text, marginBottom: 6 }}>
              <span dangerouslySetInnerHTML={{ __html: inlineFormat(item) }} />
            </li>
          ))}
        </ul>
      );
      continue;
    }

    if (line.trim() === "") {
      i++;
      continue;
    }

    elements.push(<p key={key++} style={{ fontSize: 15, lineHeight: 1.8, color: t.text, marginBottom: 16 }} dangerouslySetInnerHTML={{ __html: inlineFormat(line) }} />);
    i++;
  }

  return elements;
}

function inlineFormat(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code style="background:rgba(0,0,0,0.06);padding:2px 6px;border-radius:4px;font-size:13px">$1</code>');
}

// ── Topic Card (archive) ─────────────────────────────────────────────────
function TopicCard({ topic, t, onClick }: { topic: Topic; t: typeof LIGHT; onClick: () => void }) {
  const cat = topic.category;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: t.white,
        borderRadius: 16,
        border: `1px solid ${t.border}`,
        boxShadow: t.cardShadow,
        padding: 24,
        textAlign: "left",
        cursor: "pointer",
        transition: "transform 0.2s ease, box-shadow 0.2s ease",
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-3px)"; (e.currentTarget as HTMLElement).style.boxShadow = "0 8px 24px rgba(0,0,0,0.08)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; (e.currentTarget as HTMLElement).style.boxShadow = t.cardShadow; }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 14, background: `${CATEGORY_COLORS[cat] ?? t.indigo}15`, color: CATEGORY_COLORS[cat] ?? t.indigo, padding: "4px 10px", borderRadius: 20, fontWeight: 500 }}>
          {CATEGORY_ICONS[cat] ?? "\u{1F4D6}"} {cat}
        </span>
        <span style={{ fontSize: 11, color: t.textMuted }}>{topic.reading_time_min} min</span>
      </div>
      <h3 style={{ fontSize: 17, fontWeight: 700, color: t.text, lineHeight: 1.3, fontFamily: "'Georgia', serif", margin: 0 }}>{topic.title}</h3>
      <p style={{ fontSize: 13, color: t.textMuted, lineHeight: 1.5, margin: 0 }}>{topic.summary.slice(0, 140)}...</p>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: "auto" }}>
        <span style={{ fontSize: 11, color: t.textMuted }}>{new Date(topic.publish_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long" })}</span>
        <span style={{ fontSize: 11, color: t.textMuted }}>{"·"}</span>
        <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 8, background: `${t.indigo}10`, color: t.indigo, fontWeight: 500 }}>{DIFFICULTY_LABEL[topic.difficulty] ?? topic.difficulty}</span>
      </div>
    </button>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────
export default function CulturePage() {
  const t = useTheme();
  const [todayTopic, setTodayTopic] = useState<Topic | null>(null);
  const [archive, setArchive] = useState<Topic[]>([]);
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [categories, setCategories] = useState<Record<string, number>>({});

  const fetchToday = useCallback(async () => {
    try {
      const res = await fetch("/api/culture?mode=today");
      const data = await res.json();
      if (data.topic) setTodayTopic(data.topic);
    } catch { /* no-op */ }
  }, []);

  const fetchArchive = useCallback(async (category?: string | null) => {
    try {
      const url = `/api/culture?mode=archive&limit=50${category ? `&category=${encodeURIComponent(category)}` : ""}`;
      const res = await fetch(url);
      const data = await res.json();
      setArchive(data.topics ?? []);
    } catch { /* no-op */ }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/culture?mode=categories");
      const data = await res.json();
      setCategories(data.categories ?? {});
    } catch { /* no-op */ }
  }, []);

  const fetchFullTopic = useCallback(async (slug: string) => {
    try {
      const res = await fetch(`/api/culture?mode=topic&slug=${slug}`);
      const data = await res.json();
      if (data.topic) setSelectedTopic(data.topic);
    } catch { /* no-op */ }
  }, []);

  useEffect(() => {
    Promise.all([fetchToday(), fetchArchive(), fetchCategories()]).finally(() => setLoading(false));
  }, [fetchToday, fetchArchive, fetchCategories]);

  const handleCategoryClick = (cat: string | null) => {
    setActiveCategory(cat);
    fetchArchive(cat);
  };

  // ── Full article view ──────────────────────────────────────────────────
  if (selectedTopic) {
    return (
      <div style={{ minHeight: "100vh", background: t.cream }}>
        <Navbar />
        <main style={{ maxWidth: 720, margin: "0 auto", padding: "32px 20px 80px" }}>
          <button
            type="button"
            onClick={() => setSelectedTopic(null)}
            style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", color: t.indigo, fontSize: 14, fontWeight: 500, marginBottom: 24 }}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            Retour
          </button>

          <FadeIn>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
              <span style={{ fontSize: 14, background: `${CATEGORY_COLORS[selectedTopic.category] ?? t.indigo}15`, color: CATEGORY_COLORS[selectedTopic.category] ?? t.indigo, padding: "5px 12px", borderRadius: 20, fontWeight: 500 }}>
                {CATEGORY_ICONS[selectedTopic.category] ?? "\u{1F4D6}"} {selectedTopic.category}
              </span>
              <span style={{ fontSize: 12, color: t.textMuted }}>{selectedTopic.reading_time_min} min de lecture</span>
              <span style={{ fontSize: 12, color: t.textMuted }}>{"·"}</span>
              <span style={{ fontSize: 12, color: t.textMuted }}>{DIFFICULTY_LABEL[selectedTopic.difficulty]}</span>
            </div>
          </FadeIn>

          <FadeIn delay={80}>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: t.text, lineHeight: 1.2, fontFamily: "'Georgia', serif", marginBottom: 12 }}>{selectedTopic.title}</h1>
          </FadeIn>

          <FadeIn delay={120}>
            <p style={{ fontSize: 16, color: t.textMuted, lineHeight: 1.6, marginBottom: 32, fontStyle: "italic" }}>{selectedTopic.summary}</p>
          </FadeIn>

          <FadeIn delay={160}>
            <div style={{ background: t.white, borderRadius: 16, border: `1px solid ${t.border}`, padding: "32px 28px" }}>
              {renderMarkdown(selectedTopic.content, t)}
            </div>
          </FadeIn>

          {selectedTopic.fun_fact && (
            <FadeIn delay={200}>
              <div style={{ marginTop: 24, background: `${t.gold}12`, border: `1px solid ${t.gold}30`, borderRadius: 14, padding: "20px 24px", display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ fontSize: 24, flexShrink: 0 }}>{"\u{1F4A1}"}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: t.gold, marginBottom: 4 }}>Le saviez-vous ?</div>
                  <p style={{ fontSize: 14, color: t.text, lineHeight: 1.6, margin: 0 }}>{selectedTopic.fun_fact}</p>
                </div>
              </div>
            </FadeIn>
          )}

          {selectedTopic.tags && selectedTopic.tags.length > 0 && (
            <FadeIn delay={240}>
              <div style={{ marginTop: 24, display: "flex", flexWrap: "wrap", gap: 8 }}>
                {selectedTopic.tags.map(tag => (
                  <span key={tag} style={{ fontSize: 12, color: t.indigo, background: `${t.indigo}10`, padding: "4px 12px", borderRadius: 20 }}>#{tag}</span>
                ))}
              </div>
            </FadeIn>
          )}

          {selectedTopic.source_url && (
            <FadeIn delay={280}>
              <div style={{ marginTop: 24, fontSize: 13, color: t.textMuted }}>
                Source : <a href={selectedTopic.source_url} target="_blank" rel="noopener noreferrer" style={{ color: t.indigo, textDecoration: "underline" }}>{selectedTopic.source_name ?? "Lien"}</a>
              </div>
            </FadeIn>
          )}

          <FadeIn delay={300}>
            <div style={{ marginTop: 32, fontSize: 13, color: t.textMuted, textAlign: "center" }}>
              Publié le {new Date(selectedTopic.publish_date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}
            </div>
          </FadeIn>
        </main>
      </div>
    );
  }

  // ── Main listing view ──────────────────────────────────────────────────
  return (
    <div style={{ minHeight: "100vh", background: t.cream }}>
      <Navbar />
      <main style={{ maxWidth: 1040, margin: "0 auto", padding: "32px 20px 80px" }}>

        {/* Header */}
        <FadeIn>
          <div style={{ textAlign: "center", marginBottom: 40 }}>
            <h1 style={{ fontSize: 36, fontWeight: 800, color: t.text, fontFamily: "'Georgia', serif", marginBottom: 8 }}>
              {"\u{1F4D6}"} Culture
            </h1>
            <p style={{ fontSize: 16, color: t.textMuted, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>
              Un nouveau sujet chaque jour pour nourrir votre curiosité. Philosophie, science, art, histoire et bien plus.
            </p>
          </div>
        </FadeIn>

        {/* Sujet du jour */}
        {todayTopic && (
          <FadeIn delay={100}>
            <div style={{ marginBottom: 48 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: t.gold, textTransform: "uppercase", letterSpacing: 2 }}>{"✨"} Sujet du jour</span>
              </div>
              <button
                type="button"
                onClick={() => fetchFullTopic(todayTopic.slug)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  background: `linear-gradient(135deg, ${t.indigo}, ${t.indigo}DD)`,
                  borderRadius: 20,
                  border: "none",
                  padding: "36px 32px",
                  color: "white",
                  position: "relative",
                  overflow: "hidden",
                  transition: "transform 0.2s ease",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = "translateY(0)"; }}
              >
                <div style={{ position: "absolute", top: -40, right: -40, width: 200, height: 200, borderRadius: "50%", background: "rgba(196,169,74,0.12)" }} />
                <div style={{ position: "absolute", bottom: -60, left: -20, width: 160, height: 160, borderRadius: "50%", background: "rgba(255,255,255,0.04)" }} />
                <div style={{ position: "relative", zIndex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 16 }}>
                    <span style={{ fontSize: 13, background: "rgba(255,255,255,0.15)", padding: "4px 12px", borderRadius: 20, fontWeight: 500 }}>
                      {CATEGORY_ICONS[todayTopic.category] ?? "\u{1F4D6}"} {todayTopic.category}
                    </span>
                    <span style={{ fontSize: 12, opacity: 0.7 }}>{todayTopic.reading_time_min} min de lecture</span>
                  </div>
                  <h2 style={{ fontSize: 28, fontWeight: 800, margin: "0 0 12px", fontFamily: "'Georgia', serif", lineHeight: 1.2 }}>{todayTopic.title}</h2>
                  <p style={{ fontSize: 15, opacity: 0.85, lineHeight: 1.6, margin: "0 0 20px", maxWidth: 600 }}>{todayTopic.summary}</p>
                  <span style={{ fontSize: 14, fontWeight: 600, display: "inline-flex", alignItems: "center", gap: 6 }}>
                    Lire l&apos;article
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                </div>
              </button>
            </div>
          </FadeIn>
        )}

        {/* Fun fact du sujet du jour */}
        {todayTopic?.fun_fact && (
          <FadeIn delay={150}>
            <div style={{ marginBottom: 40, background: `${t.gold}12`, border: `1px solid ${t.gold}30`, borderRadius: 14, padding: "16px 20px", display: "flex", gap: 12, alignItems: "flex-start" }}>
              <span style={{ fontSize: 20, flexShrink: 0 }}>{"\u{1F4A1}"}</span>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: t.gold, marginBottom: 4 }}>Le saviez-vous ?</div>
                <p style={{ fontSize: 14, color: t.text, lineHeight: 1.5, margin: 0 }}>{todayTopic.fun_fact}</p>
              </div>
            </div>
          </FadeIn>
        )}

        {/* Categories filter */}
        <FadeIn delay={200}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 28 }}>
            <button
              type="button"
              onClick={() => handleCategoryClick(null)}
              style={{
                fontSize: 13,
                fontWeight: activeCategory === null ? 600 : 400,
                color: activeCategory === null ? "white" : t.text,
                background: activeCategory === null ? t.indigo : t.white,
                border: `1px solid ${activeCategory === null ? t.indigo : t.border}`,
                borderRadius: 20,
                padding: "6px 16px",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              Tous
            </button>
            {Object.keys(categories).sort().map(cat => (
              <button
                key={cat}
                type="button"
                onClick={() => handleCategoryClick(cat)}
                style={{
                  fontSize: 13,
                  fontWeight: activeCategory === cat ? 600 : 400,
                  color: activeCategory === cat ? "white" : t.text,
                  background: activeCategory === cat ? (CATEGORY_COLORS[cat] ?? t.indigo) : t.white,
                  border: `1px solid ${activeCategory === cat ? "transparent" : t.border}`,
                  borderRadius: 20,
                  padding: "6px 16px",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                }}
              >
                {CATEGORY_ICONS[cat] ?? ""} {cat} ({categories[cat]})
              </button>
            ))}
          </div>
        </FadeIn>

        {/* Archive grid */}
        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: t.textMuted, fontSize: 14 }}>Chargement...</div>
        ) : archive.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: t.textMuted, fontSize: 14 }}>
            {activeCategory ? `Aucun sujet dans la catégorie ${activeCategory}` : "Aucun sujet disponible"}
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 20 }}>
            {archive
              .filter(topic => !todayTopic || topic.slug !== todayTopic.slug)
              .map((topic, i) => (
                <FadeIn key={topic.id} delay={50 * Math.min(i, 8)}>
                  <TopicCard topic={topic} t={t} onClick={() => fetchFullTopic(topic.slug)} />
                </FadeIn>
              ))}
          </div>
        )}

        {/* Bottom CTA */}
        <FadeIn delay={300}>
          <div style={{ textAlign: "center", marginTop: 60, padding: "32px 20px", background: t.white, borderRadius: 16, border: `1px solid ${t.border}` }}>
            <p style={{ fontSize: 18, fontWeight: 700, color: t.text, fontFamily: "'Georgia', serif", marginBottom: 8 }}>Revenez demain pour un nouveau sujet</p>
            <p style={{ fontSize: 14, color: t.textMuted }}>Chaque jour, un article pour nourrir votre curiosité</p>
          </div>
        </FadeIn>
      </main>
    </div>
  );
}

"use client";

import { useCallback, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import dynamic from "next/dynamic";
import Link from "next/link";
import ArticleReader from "@/components/ArticleReader";
import Navbar from "@/components/Navbar";
import { ShareModal } from "@/components/NewsCard";
import { newsTimeAgo, useNews, type NewsArticle, type NewsParams } from "@/lib/news";
import { supabase } from "@/lib/supabase";

const CREAM = "#F7F4EE";
const INDIGO = "#2A3560";
const TEXT = "#1C1A15";
const GEORGIA = "Georgia, 'Times New Roman', serif";

const ink = (alpha: number) => `rgba(28,26,21,${alpha})`;
const black = (alpha: number) => `rgba(0,0,0,${alpha})`;
const DIM = ink(0.4);

// Hover states can't be expressed as inline styles. No quotes in here: React
// escapes them when rendering a <style> on the server, which breaks hydration.
const css = `
.ac-tab { color: ${DIM}; border-bottom: 2px solid transparent; transition: color 0.15s, border-color 0.15s; }
.ac-tab:hover { color: ${TEXT}; }
.ac-tab[aria-pressed=true] { color: ${TEXT}; font-weight: 500; border-bottom-color: ${TEXT}; }
.ac-title { color: ${TEXT}; transition: color 0.15s; }
.ac-title:hover { color: ${INDIGO}; }
.ac-action { color: ${DIM}; transition: color 0.15s; }
.ac-action:hover { color: ${TEXT}; }
.ac-read:hover { text-decoration: underline; }
.ac-retry:hover { background: ${black(0.04)}; }
.ac-noscrollbar { scrollbar-width: none; }
.ac-noscrollbar::-webkit-scrollbar { display: none; }
`;

// Recharts is only downloaded when the "Bourse" section is opened.
const MarketsDashboard = dynamic(() => import("@/components/MarketsDashboard"), {
  ssr: false,
  loading: () => <BourseLoading />,
});

const filters: { label: string; params: NewsParams; slug?: string; bourse?: boolean }[] = [
  { label: "Tout", params: { category: "general" } },
  { label: "France", params: { q: "France" } },
  { label: "Monde", params: { category: "world" } },
  { label: "Science", params: { category: "science" } },
  { label: "Tech", params: { category: "technology" } },
  { label: "Économie", params: { category: "business" } },
  { label: "Géopolitique", params: { q: "géopolitique diplomatie" } },
  { label: "Culture", params: { category: "entertainment" } },
  // The markets dashboard, formerly its own /marches page.
  { label: "Bourse", params: {}, slug: "bourse", bourse: true },
];

// The headline plus seven full rows; everything after goes to "En bref".
const FULL_ARTICLES = 8;

function SourceTag({ name }: { name: string }) {
  return (
    <span className="inline-block" style={{ fontSize: 10, color: INDIGO, background: "rgba(42,53,96,0.06)", padding: "2px 8px", borderRadius: 4 }}>
      {name}
    </span>
  );
}

function ArticleImage({
  src,
  height,
  radius,
  className = "",
  onError,
}: {
  src: string;
  height: number;
  radius: number;
  className?: string;
  onError: () => void;
}) {
  return (
    // Remote images come from arbitrary publishers, so next/image can't optimise them.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={onError}
      className={`w-full object-cover ${className}`}
      style={{ height, borderRadius: radius }}
    />
  );
}

function Headline({ article, onOpen }: { article: NewsArticle; onOpen: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  // Some feeds put the outlet's own name in the author field.
  const author = article.author && article.author !== article.source.name ? `Par ${article.author}` : null;
  const byline = [author, article.source.name, newsTimeAgo(article.publishedAt)]
    .filter(Boolean)
    .join(" · ");

  return (
    <article style={{ padding: "40px 0", borderBottom: `1px solid ${black(0.06)}` }}>
      <span className="mb-3 inline-block" style={{ fontSize: 10, color: INDIGO, background: "rgba(42,53,96,0.07)", padding: "3px 10px", borderRadius: 4 }}>
        {article.source.name}
      </span>
      <h2 className="mb-3 line-clamp-2" style={{ fontFamily: GEORGIA, fontSize: "clamp(26px, 5.5vw, 36px)", fontWeight: 400, color: TEXT, lineHeight: 1.2, letterSpacing: "-0.5px" }}>
        <button type="button" onClick={onOpen} className="ac-title text-left">
          {article.title}
        </button>
      </h2>
      {article.description && (
        <p className="mb-4" style={{ fontSize: 15, color: ink(0.6), lineHeight: 1.7 }}>{article.description}</p>
      )}
      {article.urlToImage && !imageFailed && (
        <ArticleImage src={article.urlToImage} height={320} radius={8} className="mb-4" onError={() => setImageFailed(true)} />
      )}
      <div className="mt-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="min-w-0" style={{ fontSize: 12, color: DIM }}>{byline}</p>
        <button type="button" onClick={onOpen} className="ac-read shrink-0" style={{ fontSize: 12, color: INDIGO, fontWeight: 500 }}>
          Lire l&apos;article →
        </button>
      </div>
    </article>
  );
}

function ArticleRow({ article, onOpen, onShare }: { article: NewsArticle; onOpen: () => void; onShare: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const [saved, setSaved] = useState(false);
  const hasImage = Boolean(article.urlToImage) && !imageFailed;

  return (
    <article
      className={`grid grid-cols-1 items-start ${hasImage ? "sm:grid-cols-[1fr_200px]" : ""}`}
      style={{ padding: "28px 0", gap: 24, borderBottom: `1px solid ${black(0.06)}` }}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <SourceTag name={article.source.name} />
          <span style={{ fontSize: 11, color: DIM }}>·</span>
          <span style={{ fontSize: 11, color: DIM }}>{newsTimeAgo(article.publishedAt)}</span>
        </div>
        <h3 className="mt-2" style={{ fontSize: 16, fontWeight: 500, lineHeight: 1.4 }}>
          <button type="button" onClick={onOpen} className="ac-title text-left">
            {article.title}
          </button>
        </h3>
        {article.description && (
          <p className="mt-1 line-clamp-2" style={{ fontSize: 12, color: ink(0.5), lineHeight: 1.6 }}>
            {article.description}
          </p>
        )}
        <div className="mt-3 flex" style={{ gap: 16, fontSize: 11 }}>
          <button type="button" onClick={onOpen} className="ac-action">
            Lire →
          </button>
          <button type="button" onClick={onShare} className="ac-action">
            Partager
          </button>
          <button
            type="button"
            onClick={() => setSaved(!saved)}
            aria-pressed={saved}
            className={saved ? "" : "ac-action"}
            style={saved ? { color: INDIGO, fontWeight: 500 } : undefined}
          >
            {saved ? "Sauvegardé" : "Sauvegarder"}
          </button>
        </div>
      </div>
      {hasImage && (
        <ArticleImage src={article.urlToImage!} height={120} radius={6} className="shrink-0 sm:w-[200px]" onError={() => setImageFailed(true)} />
      )}
    </article>
  );
}

function Skeleton() {
  const bar = (width: string | number, height: number, marginTop = 0) => ({
    background: black(0.06),
    height,
    width,
    borderRadius: 4,
    marginTop,
  });
  return (
    <div aria-hidden className="animate-pulse" style={{ padding: "28px 0", borderBottom: `1px solid ${black(0.06)}` }}>
      <div style={bar(80, 14)} />
      <div style={bar("90%", 24, 12)} />
      <div style={bar("70%", 24, 8)} />
      <div style={bar("100%", 14, 12)} />
      <div style={bar("85%", 14, 8)} />
    </div>
  );
}

function Notice({ title, detail, onRetry }: { title: string; detail: string; onRetry?: () => void }) {
  return (
    <div role={onRetry ? "alert" : "status"} className="text-center" style={{ padding: 60 }}>
      <p aria-hidden className="mb-3" style={{ fontSize: 32 }}>📰</p>
      <p style={{ fontSize: 15, color: TEXT }}>{title}</p>
      <p className="mt-1" style={{ fontSize: 12, color: DIM }}>{detail}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="ac-retry mt-4"
          style={{ border: `1px solid ${black(0.1)}`, borderRadius: 8, fontSize: 13, padding: "8px 20px", color: TEXT }}
        >
          Réessayer
        </button>
      )}
    </div>
  );
}

function BourseLoading() {
  return (
    <div role="status" aria-label="Chargement de la bourse" className="flex justify-center" style={{ padding: 80 }}>
      <div className="animate-spin" style={{ width: 32, height: 32, border: `2px solid ${black(0.08)}`, borderTopColor: INDIGO, borderRadius: "50%" }} />
    </div>
  );
}

export default function Actualites() {
  const [active, setActive] = useState(filters[0]);
  // undefined while the session is still being read, null once known to be absent.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const user = session?.user ?? null;
  const [sharing, setSharing] = useState<NewsArticle | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const closeReader = useCallback(() => setSelectedArticle(null), []);
  // Set after mount: the server's clock and time zone may differ from the reader's.
  const [today, setToday] = useState("");
  // The Bourse section loads its own data, so no news query runs for it.
  const { articles: rawArticles, loading, error, retry } = useNews(active.params, !active.bourse);

  // ?rubrique=bourse opens the markets section (old /marches links redirect there).
  useEffect(() => {
    const slug = new URLSearchParams(window.location.search).get("rubrique");
    const match = filters.find((filter) => filter.slug && filter.slug === slug);
    if (match) setActive(match);
  }, []);

  const selectFilter = (filter: (typeof filters)[number]) => {
    setActive(filter);
    const url = new URL(window.location.href);
    if (filter.slug) url.searchParams.set("rubrique", filter.slug);
    else url.searchParams.delete("rubrique");
    window.history.replaceState(null, "", url);
  };

  useEffect(() => {
    const date = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
    setToday(date.charAt(0).toUpperCase() + date.slice(1));
  }, []);

  // The page is public; the session is needed to share an article and to open the Bourse section.
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => subscription.unsubscribe();
  }, []);

  const articles = (rawArticles ?? []).filter(
    (article) => article.title && article.title !== "[Removed]" && article.description,
  );
  const [headline, ...rest] = articles;
  const rows = rest.slice(0, FULL_ARTICLES - 1);
  const briefs = rest.slice(FULL_ARTICLES - 1);

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <style>{css}</style>
      <Navbar />

      <main className="mx-auto w-full px-4 sm:px-5" style={{ maxWidth: 860, paddingBlock: 40 }}>
        <header style={{ paddingTop: 60 }}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
            <h1 style={{ fontFamily: GEORGIA, fontSize: "clamp(32px, 7vw, 42px)", fontWeight: 400, color: TEXT, letterSpacing: "-1px" }}>
              Actualités
            </h1>
            <p style={{ fontSize: 13, color: ink(0.35) }}>{today}</p>
          </div>
          <p className="mt-2" style={{ fontSize: 13, color: DIM }}>
            Sources sélectionnées · Mis à jour toutes les 5 minutes
          </p>

          <nav aria-label="Rubriques" className="ac-noscrollbar mt-5 flex overflow-x-auto" style={{ borderBottom: `1px solid ${black(0.08)}` }}>
            {filters.map((filter) => (
              <button
                key={filter.label}
                type="button"
                onClick={() => selectFilter(filter)}
                aria-pressed={active.label === filter.label}
                className="ac-tab -mb-px shrink-0"
                style={{ padding: "10px 20px", fontSize: 13 }}
              >
                {filter.label}
              </button>
            ))}
          </nav>
        </header>

        {active.bourse ? null : error ? (
          <Notice
            title="Impossible de charger les actualités"
            detail="Vérifie ta connexion ou réessaie dans quelques instants."
            onRetry={retry}
          />
        ) : loading ? (
          <div style={{ paddingTop: 12 }}>
            <span className="sr-only" role="status">Chargement des actualités…</span>
            <Skeleton />
            <Skeleton />
            <Skeleton />
            <Skeleton />
          </div>
        ) : !headline ? (
          <Notice title="Aucun article disponible pour ce filtre" detail="Essaie une autre rubrique." />
        ) : (
          <>
            <Headline article={headline} onOpen={() => setSelectedArticle(headline)} />

            {rows.length > 0 && (
              <div className="relative" style={{ height: 1, background: black(0.07), marginTop: 28 }}>
                <span
                  className="absolute left-1/2 top-1/2 whitespace-nowrap"
                  style={{ transform: "translate(-50%, -50%)", background: CREAM, padding: "0 16px", fontSize: 11, color: ink(0.3), textTransform: "uppercase", letterSpacing: "0.12em" }}
                >
                  Les dernières
                </span>
              </div>
            )}

            {rows.map((article) => (
              <ArticleRow
                key={article.url}
                article={article}
                onOpen={() => setSelectedArticle(article)}
                onShare={() => setSharing(article)}
              />
            ))}

            {briefs.length > 0 && (
              <section style={{ marginTop: 40 }}>
                <h2 className="mb-4 pb-2" style={{ fontSize: 11, fontWeight: 400, color: DIM, textTransform: "uppercase", letterSpacing: "0.12em", borderBottom: `1px solid ${black(0.06)}` }}>
                  En bref
                </h2>
                <ul>
                  {briefs.map((article) => (
                    <li key={article.url} className="flex items-center justify-between" style={{ padding: "10px 0", borderBottom: `1px solid ${black(0.04)}` }}>
                      <span className="w-24 shrink-0 truncate sm:w-32" style={{ fontSize: 10, color: DIM }}>
                        {article.source.name}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedArticle(article)}
                        className="ac-title min-w-0 flex-1 truncate text-left"
                        style={{ fontSize: 13, padding: "0 16px" }}
                      >
                        {article.title}
                      </button>
                      <span className="shrink-0" style={{ fontSize: 10, color: DIM }}>
                        {newsTimeAgo(article.publishedAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>

      {active.bourse &&
        (session === undefined ? (
          <BourseLoading />
        ) : session === null ? (
          <div className="mx-auto px-5 pb-16 text-center" style={{ maxWidth: 520 }}>
            <p aria-hidden className="mb-3" style={{ fontSize: 32 }}>📈</p>
            <p style={{ fontFamily: GEORGIA, fontSize: 22, color: TEXT }}>La bourse est réservée aux membres</p>
            <p className="mt-2" style={{ fontSize: 13, color: DIM, lineHeight: 1.6 }}>
              Connecte-toi pour suivre les indices, les actions, ta watchlist et le flux des marchés.
            </p>
            <div className="mt-5 flex justify-center gap-3">
              <Link href="/login" style={{ background: INDIGO, color: CREAM, fontSize: 13, fontWeight: 500, padding: "9px 22px", borderRadius: 20 }}>
                Se connecter
              </Link>
              <Link href="/signup" className="ac-retry" style={{ border: `1px solid ${black(0.1)}`, color: TEXT, fontSize: 13, padding: "9px 22px", borderRadius: 20 }}>
                Créer un compte
              </Link>
            </div>
          </div>
        ) : (
          <MarketsDashboard session={session} />
        ))}


      {selectedArticle && (
        <ArticleReader
          key={selectedArticle.url}
          article={selectedArticle}
          onClosed={closeReader}
          onShare={() => setSharing(selectedArticle)}
        />
      )}

      {sharing && <ShareModal article={sharing} user={user} onClose={() => setSharing(null)} />}
    </div>
  );
}

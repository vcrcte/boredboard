"use client";

import { useCallback, useEffect, useState } from "react";
import { newsTimeAgo, type NewsArticle } from "@/lib/news";

const CREAM = "#F7F4EE";
const INDIGO = "#2A3560";
const TEXT = "#1C1A15";
const GEORGIA = "Georgia, 'Times New Roman', serif";
const PANEL_TRANSITION_MS = 350;

const ink = (alpha: number) => `rgba(28,26,21,${alpha})`;
const black = (alpha: number) => `rgba(0,0,0,${alpha})`;
const DIM = ink(0.4);
const ACTION = "text-[rgba(28,26,21,0.4)] transition-colors hover:text-[#1C1A15]";

// NewsAPI only gives the opening of the article, ending with "… [+1234 chars]".
function articleExcerpt(article: NewsArticle) {
  const excerpt = (article.content ?? "").replace(/\s*\[\+\d+ chars\]\s*$/, "").trim();
  // Many feeds repeat the description as the content: don't print it twice.
  if (!excerpt || (article.description && excerpt.startsWith(article.description.slice(0, 60)))) return null;
  return excerpt;
}

export default function ArticleReader({
  article,
  onClosed,
  onShare,
}: {
  article: NewsArticle;
  onClosed: () => void;
  /** Omit to hide the "share on BoredBoard" action. */
  onShare?: () => void;
}) {
  // The panel is mounted off-screen, then slid in on the next frame.
  const [visible, setVisible] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    document.body.style.overflow = "hidden";
    return () => {
      cancelAnimationFrame(frame);
      document.body.style.overflow = "";
    };
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(onClosed, PANEL_TRANSITION_MS);
  }, [onClosed]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  // Some feeds put the outlet's own name in the author field.
  const author = article.author && article.author !== article.source.name ? article.author : null;
  const excerpt = articleExcerpt(article);
  const hasImage = Boolean(article.urlToImage) && !imageFailed;

  return (
    <>
      <div
        className="fixed inset-0"
        onClick={close}
        style={{
          background: "rgba(0,0,0,0.3)",
          backdropFilter: "blur(2px)",
          WebkitBackdropFilter: "blur(2px)",
          zIndex: 40,
          opacity: visible ? 1 : 0,
          transition: `opacity ${PANEL_TRANSITION_MS}ms ease-out`,
        }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={article.title}
        className="fixed right-0 top-0 flex flex-col"
        style={{
          height: "100vh",
          width: "min(100vw, max(600px, 60vw))",
          maxWidth: 900,
          background: "#FFFFFF",
          zIndex: 50,
          boxShadow: "-8px 0 40px rgba(0,0,0,0.12)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: `transform ${PANEL_TRANSITION_MS}ms cubic-bezier(0.16,1,0.3,1)`,
        }}
      >
        <header className="flex shrink-0 items-center" style={{ padding: "20px 24px", borderBottom: `1px solid ${black(0.07)}`, gap: 12 }}>
          <button
            type="button"
            onClick={close}
            aria-label="Fermer"
            className="flex shrink-0 items-center justify-center text-[rgba(28,26,21,0.4)] transition-colors hover:text-[#1C1A15]"
            style={{ width: 32, height: 32, borderRadius: 8, fontSize: 18, background: black(0.04) }}
          >
            ✕
          </button>
          <span className="min-w-0 truncate" style={{ background: "rgba(42,53,96,0.07)", color: INDIGO, fontSize: 11, padding: "3px 10px", borderRadius: 4 }}>
            {article.source.name}
          </span>
          <a href={article.url} target="_blank" rel="noopener noreferrer" className={`${ACTION} ml-auto shrink-0`} style={{ fontSize: 11 }}>
            Lire sur {article.source.name} →
          </a>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <article className="mx-auto" style={{ maxWidth: 680, padding: "36px 40px" }}>
            <div className="mb-4 flex items-center gap-2">
              <span style={{ fontSize: 10, color: INDIGO, background: "rgba(42,53,96,0.07)", padding: "2px 8px", borderRadius: 4 }}>
                {article.source.name}
              </span>
              <span style={{ fontSize: 11, color: DIM }}>·</span>
              <span style={{ fontSize: 11, color: DIM }}>{newsTimeAgo(article.publishedAt)}</span>
            </div>

            <h1 className="mb-4" style={{ fontFamily: GEORGIA, fontSize: 28, fontWeight: 400, color: TEXT, lineHeight: 1.25, letterSpacing: "-0.5px" }}>
              {article.title}
            </h1>

            {author && (
              <p className="mb-5" style={{ fontSize: 12, color: ink(0.45) }}>Par {author}</p>
            )}

            <div className="mb-5" style={{ height: 1, background: black(0.07) }} />

            {hasImage && (
              <figure className="mb-5">
                {/* Remote images come from arbitrary publishers, so next/image can't optimise them. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={article.urlToImage!}
                  alt=""
                  loading="lazy"
                  onError={() => setImageFailed(true)}
                  className="w-full object-cover"
                  style={{ maxHeight: 300, borderRadius: 8 }}
                />
                <figcaption className="mt-2 text-center" style={{ fontSize: 11, color: DIM, fontStyle: "italic" }}>
                  {[article.source.name, author].filter(Boolean).join(" / ")}
                </figcaption>
              </figure>
            )}

            {article.description && (
              <p className="mb-5" style={{ fontFamily: GEORGIA, fontSize: 17, color: TEXT, lineHeight: 1.65 }}>
                {article.description}
              </p>
            )}

            {excerpt && (
              <p className="mb-5" style={{ fontSize: 15, color: ink(0.7), lineHeight: 1.8 }}>
                {excerpt}
              </p>
            )}

            <div style={{ background: CREAM, borderRadius: 10, padding: "18px 20px" }}>
              <p style={{ fontSize: 12, color: ink(0.55), lineHeight: 1.6 }}>
                Ceci est le début de l&apos;article. La suite est à lire sur le site de {article.source.name}.
              </p>
              <a
                href={article.url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-block hover:brightness-125"
                style={{ background: INDIGO, color: CREAM, fontSize: 13, fontWeight: 500, padding: "9px 20px", borderRadius: 20 }}
              >
                Lire l&apos;article complet →
              </a>
            </div>

            <div className="mt-6 flex" style={{ gap: 16, fontSize: 12, paddingTop: 16, borderTop: `1px solid ${black(0.07)}` }}>
              {onShare && (
                <button type="button" onClick={onShare} className={ACTION}>
                  Partager sur BoredBoard
                </button>
              )}
              <button
                type="button"
                onClick={() => setSaved(!saved)}
                aria-pressed={saved}
                className={saved ? "" : ACTION}
                style={saved ? { color: INDIGO, fontWeight: 500 } : undefined}
              >
                {saved ? "Sauvegardé" : "Sauvegarder"}
              </button>
            </div>
          </article>
        </div>
      </aside>
    </>
  );
}

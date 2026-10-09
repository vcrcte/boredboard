"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { newsTimeAgo, type NewsArticle } from "@/lib/news";
import { ensureProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

const CREAM = "#F7F4EE";
const INDIGO = "#2A3560";
const TEXT = "#1C1A15";
const DIM = "rgba(28,26,21,0.4)";
const BORDER = "rgba(0,0,0,0.07)";

export function ShareModal({
  article,
  user,
  onClose,
  onShared,
}: {
  article: NewsArticle;
  user: User | null;
  onClose: () => void;
  onShared?: () => void;
}) {
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setError(null);
    setSubmitting(true);

    // posts.user_id references profiles, so the profile must exist first.
    const profileError = await ensureProfile(user);
    if (profileError) {
      setError(`Ton profil n'a pas pu être créé : ${profileError}`);
      setSubmitting(false);
      return;
    }

    const { error: insertError } = await supabase.from("posts").insert({
      user_id: user.id,
      type: "article",
      // The post content is required: the article title stands in for an empty comment.
      content: comment.trim() || article.title,
      url: article.url,
    });

    if (insertError) {
      setError(`Le partage a échoué : ${insertError.message}`);
      setSubmitting(false);
      return;
    }

    onShared?.();
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center px-5"
      style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(4px)", WebkitBackdropFilter: "blur(4px)" }}
      onClick={onClose}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="share-title"
        onClick={(event) => event.stopPropagation()}
        onSubmit={handleSubmit}
        className="w-full"
        style={{ maxWidth: 480, background: "#FFFFFF", borderRadius: 20, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.25)" }}
      >
        <div className="flex items-center">
          <h2 id="share-title" style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>
            Partager sur BoredBoard
          </h2>
          <button type="button" onClick={onClose} aria-label="Fermer" className="ml-auto hover:opacity-60" style={{ fontSize: 16, color: DIM }}>
            ✕
          </button>
        </div>

        <div className="mt-3" style={{ background: CREAM, borderRadius: 10, padding: "10px 14px" }}>
          <p style={{ fontSize: 10, color: INDIGO }}>{article.source.name}</p>
          <p className="mt-0.5 line-clamp-2" style={{ fontSize: 13, fontWeight: 500, color: TEXT, lineHeight: 1.4 }}>
            {article.title}
          </p>
        </div>

        {user ? (
          <>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Ajouter un commentaire..."
              aria-label="Commentaire"
              rows={3}
              autoFocus
              className="mt-3 block w-full resize-none placeholder:text-[rgba(28,26,21,0.4)]"
              style={{ background: CREAM, border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: "12px 14px", fontSize: 13, color: TEXT, outline: "none" }}
            />
            {error && (
              <p role="alert" className="mt-3" style={{ fontSize: 12, color: "#C0392B" }}>
                {error}
              </p>
            )}
            <div className="mt-4 flex items-center justify-between gap-3">
              <p style={{ fontSize: 11, color: DIM }}>Visible par tes abonnés</p>
              <button
                type="submit"
                disabled={submitting}
                className="hover:brightness-125 disabled:cursor-not-allowed disabled:opacity-50"
                style={{ background: INDIGO, color: CREAM, fontSize: 13, fontWeight: 500, padding: "10px 24px", borderRadius: 20 }}
              >
                {submitting ? "Partage…" : "Publier"}
              </button>
            </div>
          </>
        ) : (
          <div className="mt-4 flex items-center justify-between gap-3">
            <p style={{ fontSize: 12, color: DIM }}>Connecte-toi pour partager cet article.</p>
            <Link href="/login" style={{ background: INDIGO, color: CREAM, fontSize: 13, fontWeight: 500, padding: "10px 24px", borderRadius: 20 }}>
              Se connecter
            </Link>
          </div>
        )}
      </form>
    </div>
  );
}

export default function NewsCard({
  article,
  user,
  onShared,
}: {
  article: NewsArticle;
  /** The signed-in user, needed to share the article as a post. */
  user: User | null;
  onShared?: () => void;
}) {
  const [sharing, setSharing] = useState(false);
  const [saved, setSaved] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <article
      className="transition-shadow hover:shadow-sm"
      style={{ background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: 14, padding: 16 }}
    >
      <div className="flex items-center gap-2">
        <span className="truncate" style={{ background: "rgba(42,53,96,0.08)", color: INDIGO, fontSize: 10, borderRadius: 10, padding: "2px 8px" }}>
          {article.source.name}
        </span>
        <span className="ml-auto shrink-0" style={{ fontSize: 11, color: DIM }}>
          {newsTimeAgo(article.publishedAt)}
        </span>
      </div>

      <a href={article.url} target="_blank" rel="noopener noreferrer" className="block">
        <h3 className="mt-2 line-clamp-2" style={{ fontSize: 15, fontWeight: 500, color: TEXT, lineHeight: 1.4 }}>
          {article.title}
        </h3>
        {article.description && (
          <p className="mt-1 line-clamp-2" style={{ fontSize: 12, color: "rgba(28,26,21,0.55)", lineHeight: 1.6 }}>
            {article.description}
          </p>
        )}
        {article.urlToImage && !imageFailed && (
          // Remote images come from arbitrary publishers, so next/image can't optimise them.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={article.urlToImage}
            alt=""
            loading="lazy"
            onError={() => setImageFailed(true)}
            className="mt-3 w-full object-cover"
            style={{ height: 180, borderRadius: 10 }}
          />
        )}
      </a>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="min-w-0 truncate" style={{ fontSize: 11, color: DIM }}>
          {article.author && `Par ${article.author}`}
        </p>
        <div className="ml-auto flex shrink-0 items-center" style={{ gap: 12, fontSize: 11 }}>
          <a href={article.url} target="_blank" rel="noopener noreferrer" className="hover:underline" style={{ color: INDIGO }}>
            Lire l&apos;article →
          </a>
          <button type="button" onClick={() => setSharing(true)} className="hover:underline" style={{ color: "rgba(28,26,21,0.55)" }}>
            Partager
          </button>
          <button
            type="button"
            onClick={() => setSaved(!saved)}
            aria-label="Sauvegarder"
            aria-pressed={saved}
            style={{ opacity: saved ? 1 : 0.45 }}
          >
            ⊞
          </button>
        </div>
      </div>

      {sharing && (
        <ShareModal article={article} user={user} onClose={() => setSharing(false)} onShared={onShared} />
      )}
    </article>
  );
}

export function NewsSkeleton() {
  return (
    <div aria-hidden className="animate-pulse" style={{ background: "rgba(0,0,0,0.05)", borderRadius: 14, height: 120 }} />
  );
}

export function NewsError({ onRetry }: { onRetry: () => void }) {
  return (
    <div role="alert" className="text-center" style={{ background: "#FFFFFF", border: `1px solid ${BORDER}`, borderRadius: 14, padding: "40px 20px" }}>
      <p style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>Impossible de charger les actualités</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-4 hover:bg-black/[0.04]"
        style={{ border: "1px solid rgba(0,0,0,0.1)", borderRadius: 8, fontSize: 12, padding: "6px 16px", color: "rgba(28,26,21,0.6)" }}
      >
        Réessayer
      </button>
    </div>
  );
}

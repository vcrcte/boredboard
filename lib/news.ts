import { useCallback, useEffect, useState } from "react";

export type NewsArticle = {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  /** First ~200 characters of the article body, as provided by NewsAPI. */
  content?: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
};

export type NewsParams = { category?: string; q?: string };

type NewsState = {
  /** null while loading. */
  articles: NewsArticle[] | null;
  error: boolean;
};

/**
 * Loads articles from /api/news. Nothing is fetched while `enabled` is false,
 * and the request is repeated whenever the params change.
 */
export function useNews(params: NewsParams, enabled = true) {
  const [state, setState] = useState<NewsState>({ articles: null, error: false });
  const [attempt, setAttempt] = useState(0);
  const { category, q } = params;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState({ articles: null, error: false });

    const search = new URLSearchParams();
    if (category) search.set("category", category);
    if (q) search.set("q", q);

    fetch(`/api/news?${search}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.status !== "ok") throw new Error(data.message);
        if (!cancelled) setState({ articles: data.articles, error: false });
      })
      .catch(() => {
        if (!cancelled) setState({ articles: null, error: true });
      });

    return () => {
      cancelled = true;
    };
  }, [category, q, enabled, attempt]);

  const retry = useCallback(() => setAttempt((current) => current + 1), []);

  return { ...state, loading: enabled && !state.error && state.articles === null, retry };
}

export function newsTimeAgo(date: string) {
  const minutes = Math.floor((Date.now() - new Date(date).getTime()) / 60000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return days === 1 ? "hier" : `il y a ${days}j`;
}

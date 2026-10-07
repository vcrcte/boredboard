import { useCallback, useEffect, useRef, useState } from "react";

export type NewsArticle = {
  source: { id: string | null; name: string };
  author: string | null;
  title: string;
  description: string | null;
  content?: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
};

export type NewsParams = { category?: string; q?: string };

type NewsState = {
  articles: NewsArticle[] | null;
  error: boolean;
};

const MAX_RETRIES = 3;
const RETRY_DELAYS = [5_000, 15_000, 30_000]; // 5s, 15s, 30s

/**
 * Loads articles from /api/news with automatic retry on failure.
 * Cache-first on the server means this almost never fails, but
 * if it does, it retries up to 3 times with increasing delays.
 */
export function useNews(params: NewsParams, enabled = true) {
  const [state, setState] = useState<NewsState>({ articles: null, error: false });
  const [attempt, setAttempt] = useState(0);
  const retryCount = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();
  const { category, q } = params;

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setState((prev) => prev.articles ? prev : { articles: null, error: false });

    const search = new URLSearchParams();
    if (category) search.set("category", category);
    if (q) search.set("q", q);

    fetch(`/api/news?${search}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || data.status !== "ok") throw new Error(data.message);
        if (!cancelled) {
          setState({ articles: data.articles, error: false });
          retryCount.current = 0; // reset on success
        }
      })
      .catch(() => {
        if (cancelled) return;

        // Auto-retry with backoff
        if (retryCount.current < MAX_RETRIES) {
          const delay = RETRY_DELAYS[retryCount.current] ?? 30_000;
          retryCount.current += 1;
          retryTimer.current = setTimeout(() => {
            if (!cancelled) setAttempt((c) => c + 1);
          }, delay);
        } else {
          setState({ articles: null, error: true });
        }
      });

    return () => {
      cancelled = true;
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [category, q, enabled, attempt]);

  const retry = useCallback(() => {
    retryCount.current = 0;
    setAttempt((c) => c + 1);
  }, []);

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

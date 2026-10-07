import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60; // CDN cache 1 min

/* ── Supabase (service role for cache writes) ──────────────── */
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

/* ── Types ──────────────────────────────────────────────────── */
type NDArticle = {
  title: string | null;
  description: string | null;
  link: string | null;
  image_url: string | null;
  pubDate: string;
  source_name?: string;
  source_id?: string;
};

type CachedArticle = {
  title: string;
  description: string | null;
  url: string;
  urlToImage: string | null;
  publishedAt: string;
  source: { name: string };
  author: string | null;
};

/* ── Category mapping ──────────────────────────────────────── */
const categoryMap: Record<string, string> = {
  general: "top",
  "Actualités": "top",
  science: "science",
  Science: "science",
  technology: "technology",
  Tech: "technology",
  business: "business",
  entertainment: "entertainment",
  health: "health",
  sports: "sports",
  world: "top",
  nation: "top",
};

/* ── Cache helpers ─────────────────────────────────────────── */
const CACHE_TTL_MINUTES = 60; // refresh from API every hour

async function getCached(cat: string, q: string): Promise<{ articles: CachedArticle[]; fresh: boolean } | null> {
  const { data } = await supabase
    .from("cached_news")
    .select("articles, expires_at")
    .eq("category", cat)
    .eq("query", q)
    .maybeSingle();

  if (!data) return null;

  const fresh = new Date(data.expires_at) > new Date();
  return { articles: data.articles as CachedArticle[], fresh };
}

async function setCache(cat: string, q: string, articles: CachedArticle[]) {
  const expires = new Date(Date.now() + CACHE_TTL_MINUTES * 60_000).toISOString();
  await supabase
    .from("cached_news")
    .upsert(
      { category: cat, query: q, articles, fetched_at: new Date().toISOString(), expires_at: expires },
      { onConflict: "category,query" }
    );
}

/* ── Fetch from NewsData API ───────────────────────────────── */
async function fetchFromAPI(cat: string, q: string): Promise<CachedArticle[] | null> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) return null;

  const params = new URLSearchParams({ apikey: apiKey, language: "fr" });
  if (q) {
    params.set("q", q);
  } else {
    params.set("category", cat);
  }

  const res = await fetch(`https://newsdata.io/api/1/latest?${params}`, {
    signal: AbortSignal.timeout(8000), // 8s max
  });

  const data = await res.json();
  if (data.status !== "success") return null;

  return ((data.results ?? []) as NDArticle[])
    .filter((a) => a.link && a.title && a.description)
    .map((a) => ({
      title: a.title!,
      description: a.description,
      url: a.link!,
      urlToImage: a.image_url,
      publishedAt: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(a.pubDate)
        ? `${a.pubDate.replace(" ", "T")}Z`
        : a.pubDate,
      source: { name: a.source_name || a.source_id || "Source inconnue" },
      author: a.source_name ?? null,
    }));
}

/* ── Main handler ──────────────────────────────────────────── */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawCategory = searchParams.get("category") || "general";
  const query = searchParams.get("q") || "";
  const cat = categoryMap[rawCategory] || "top";

  try {
    // 1. Check cache first
    const cached = await getCached(cat, query);

    // 2. If cache is fresh, serve it immediately
    if (cached?.fresh) {
      return NextResponse.json(
        { status: "ok", articles: cached.articles, source: "cache" },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
      );
    }

    // 3. Cache is stale or missing → try API
    const freshArticles = await fetchFromAPI(cat, query);

    if (freshArticles && freshArticles.length > 0) {
      // Save to cache (fire-and-forget)
      setCache(cat, query, freshArticles).catch(() => {});

      return NextResponse.json(
        { status: "ok", articles: freshArticles, source: "api" },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
      );
    }

    // 4. API failed → serve stale cache if available
    if (cached?.articles && cached.articles.length > 0) {
      return NextResponse.json(
        { status: "ok", articles: cached.articles, source: "stale-cache" },
        { headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300" } }
      );
    }

    // 5. Nothing at all
    return NextResponse.json({ status: "error", message: "Aucune actualité disponible", articles: [] });
  } catch {
    // Last resort: try stale cache on any crash
    try {
      const fallback = await getCached(cat, query);
      if (fallback?.articles && fallback.articles.length > 0) {
        return NextResponse.json({ status: "ok", articles: fallback.articles, source: "fallback-cache" });
      }
    } catch { /* ignore */ }

    return NextResponse.json({ status: "error", message: "Service temporairement indisponible", articles: [] });
  }
}

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

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

const CACHE_TTL_MINUTES = 60;

/* ── Cache helpers ─────────────────────────────────────────── */
async function getCached(cat: string, q: string): Promise<{ articles: CachedArticle[]; fresh: boolean } | null> {
  try {
    let query = supabase
      .from("cached_news")
      .select("articles, expires_at")
      .eq("category", cat);

    if (q) {
      query = query.eq("query", q);
    } else {
      query = query.or("query.is.null,query.eq.");
    }

    const { data, error } = await query.maybeSingle();
    if (error || !data) return null;

    const fresh = new Date(data.expires_at) > new Date();
    return { articles: data.articles as CachedArticle[], fresh };
  } catch {
    return null;
  }
}

async function setCache(cat: string, q: string, articles: CachedArticle[]) {
  try {
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + CACHE_TTL_MINUTES * 60_000).toISOString();
    const row = {
      category: cat,
      query: q || null,
      articles,
      fetched_at: now,
      expires_at: expires,
    };

    await supabase
      .from("cached_news")
      .delete()
      .eq("category", cat)
      .or(q ? `query.eq.${q}` : "query.is.null,query.eq.");

    await supabase.from("cached_news").insert(row);
  } catch {
    // Cache write failed — not critical
  }
}

/* ── Fetch from NewsData API ───────────────────────────────── */
let _lastDiag: Record<string, unknown> = {};

async function fetchFromAPI(cat: string, q: string, lang = "fr"): Promise<CachedArticle[] | null> {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) {
    _lastDiag = { step: "no-api-key" };
    return null;
  }

  try {
    const params = new URLSearchParams({ apikey: apiKey, language: lang });
    if (q) {
      params.set("q", q);
    } else {
      params.set("category", cat);
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`https://newsdata.io/api/1/latest?${params}`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    const data = await res.json();
    if (data.status !== "success") {
      _lastDiag = { step: "api-not-success", apiStatus: data.status, apiMessage: data.results?.message ?? data.message ?? "unknown" };
      return null;
    }

    _lastDiag = { step: "api-ok", rawCount: (data.results ?? []).length };

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
  } catch (e) {
    _lastDiag = { step: "api-error", error: String(e).slice(0, 200) };
    return null;
  }
}

/* ── Main handler ──────────────────────────────────────────── */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const rawCategory = searchParams.get("category") || "general";
  const query = searchParams.get("q") || "";
  const cat = categoryMap[rawCategory] || "top";

  const headers = {
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    "X-News-Version": "3",
  };

  // 1. Check cache
  const cached = await getCached(cat, query);

  // 2. Fresh cache → serve immediately
  if (cached?.fresh && cached.articles.length > 0) {
    return NextResponse.json(
      { status: "ok", articles: cached.articles, source: "cache" },
      { headers }
    );
  }

  // 3. Stale or missing → try API
  const freshArticles = await fetchFromAPI(cat, query);

  if (freshArticles && freshArticles.length > 0) {
    setCache(cat, query, freshArticles);
    return NextResponse.json(
      { status: "ok", articles: freshArticles, source: "api" },
      { headers }
    );
  }

  // 4. API failed → serve stale cache if available
  if (cached?.articles && cached.articles.length > 0) {
    return NextResponse.json(
      { status: "ok", articles: cached.articles, source: "stale-cache" },
      { headers }
    );
  }

  // 5. Nothing at all — return ok with empty (client will retry)
  return NextResponse.json(
    { status: "ok", articles: [], source: "empty", _diag: _lastDiag },
    { headers: { "Cache-Control": "no-cache", "X-News-Version": "3" } }
  );
}

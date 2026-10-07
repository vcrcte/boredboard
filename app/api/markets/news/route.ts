import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 300;

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

const CACHE_KEY = "business";
const CACHE_TTL_MINUTES = 60;

async function getCached(): Promise<{ articles: CachedArticle[]; fresh: boolean } | null> {
  try {
    const { data, error } = await supabase
      .from("cached_news")
      .select("articles, expires_at")
      .eq("category", CACHE_KEY)
      .or("query.is.null,query.eq.")
      .maybeSingle();

    if (error || !data) return null;
    const fresh = new Date(data.expires_at) > new Date();
    return { articles: data.articles as CachedArticle[], fresh };
  } catch {
    return null;
  }
}

async function setCache(articles: CachedArticle[]) {
  try {
    const now = new Date().toISOString();
    const expires = new Date(Date.now() + CACHE_TTL_MINUTES * 60_000).toISOString();

    await supabase
      .from("cached_news")
      .delete()
      .eq("category", CACHE_KEY)
      .or("query.is.null,query.eq.");

    await supabase.from("cached_news").insert({
      category: CACHE_KEY,
      query: null,
      articles,
      fetched_at: now,
      expires_at: expires,
    });
  } catch {
    // not critical
  }
}

function mapArticle(a: NDArticle): CachedArticle {
  return {
    title: a.title!,
    description: a.description,
    url: a.link!,
    urlToImage: a.image_url,
    publishedAt: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(a.pubDate)
      ? `${a.pubDate.replace(" ", "T")}Z`
      : a.pubDate,
    source: { name: a.source_name || a.source_id || "Source inconnue" },
    author: a.source_name ?? null,
  };
}

export async function GET() {
  const headers = {
    "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
    "X-News-Version": "3",
  };

  // 1. Cache first
  const cached = await getCached();
  if (cached?.fresh && cached.articles.length > 0) {
    return NextResponse.json({ status: "ok", articles: cached.articles }, { headers });
  }

  // 2. Try API
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (apiKey) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);

      const [resFr, resEn] = await Promise.all([
        fetch(
          `https://newsdata.io/api/1/latest?apikey=${apiKey}&category=business&language=fr`,
          { signal: controller.signal }
        ),
        fetch(
          `https://newsdata.io/api/1/latest?apikey=${apiKey}&category=business&language=en`,
          { signal: controller.signal }
        ),
      ]);
      clearTimeout(timeout);

      const dataFr = await resFr.json();
      const dataEn = await resEn.json();

      const raw = [
        ...((dataFr.results ?? []) as NDArticle[]),
        ...((dataEn.results ?? []) as NDArticle[]),
      ];

      const articles = raw
        .filter((a) => a.link && a.title)
        .sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())
        .slice(0, 10)
        .map(mapArticle);

      if (articles.length > 0) {
        setCache(articles);
        return NextResponse.json({ status: "ok", articles }, { headers });
      }
    } catch {
      // API failed — fall through to stale cache
    }
  }

  // 3. Stale cache fallback
  if (cached?.articles && cached.articles.length > 0) {
    return NextResponse.json({ status: "ok", articles: cached.articles }, { headers });
  }

  // 4. Empty — never "error", client retries
  return NextResponse.json(
    { status: "ok", articles: [] },
    { headers: { "Cache-Control": "no-cache", "X-News-Version": "3" } }
  );
}

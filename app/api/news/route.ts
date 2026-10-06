import { NextResponse } from "next/server";

// Articles from GNews, reshaped into the NewsAPI format the pages already read.
// Failures answer 200 with no articles: the page shows its "retry" message.

type GNewsArticle = {
  title: string | null;
  description: string | null;
  url: string | null;
  image: string | null;
  publishedAt: string;
  source?: { name?: string };
};

// GNews categories, plus the labels the pages send (dashboard: "Actualités").
const categoryMap: Record<string, string> = {
  general: "general",
  Actualités: "general",
  science: "science",
  Science: "science",
  technology: "technology",
  Tech: "technology",
  business: "business",
  entertainment: "entertainment",
  health: "health",
  sports: "sports",
  world: "world",
  nation: "nation",
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || "general";
  const query = searchParams.get("q") || "";

  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return NextResponse.json({ status: "error", message: "GNEWS_API_KEY manquante", articles: [] });

  try {
    const url = query
      ? `https://gnews.io/api/v4/search?q=${encodeURIComponent(query)}&lang=fr&max=20&apikey=${apiKey}`
      : `https://gnews.io/api/v4/top-headlines?category=${categoryMap[category] || "general"}&lang=fr&max=20&apikey=${apiKey}`;

    const res = await fetch(url, { next: { revalidate: 900 } }); // cache 15 minutes
    const data = await res.json();
    if (!res.ok) return NextResponse.json({ status: "error", message: data.errors?.[0] ?? "Erreur GNews", articles: [] });

    const articles = ((data.articles ?? []) as GNewsArticle[])
      .filter((article) => article.url && article.title && article.description)
      .map((article) => ({
        title: article.title,
        description: article.description,
        url: article.url,
        urlToImage: article.image,
        publishedAt: article.publishedAt,
        source: { name: article.source?.name || "Source inconnue" },
        author: article.source?.name ?? null,
      }));

    return NextResponse.json({ status: "ok", articles });
  } catch {
    return NextResponse.json({ status: "error", message: "GNews injoignable", articles: [] });
  }
}

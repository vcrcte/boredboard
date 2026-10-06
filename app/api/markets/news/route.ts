import { NextResponse } from "next/server";

// Built as a static route: rebuilt every 15 minutes, even when an early return skips the cached fetch.
export const revalidate = 900;

// Failures answer 200 with no articles: the page shows its "retry" message,
// and a missing key or a GNews outage no longer shows up as a server error.
function unavailable(message: string) {
  return NextResponse.json({ status: "error", message, articles: [] });
}

type GNewsArticle = {
  title: string | null;
  description: string | null;
  url: string | null;
  image: string | null;
  publishedAt: string;
  source?: { name?: string };
};

export async function GET() {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) return unavailable("GNEWS_API_KEY manquante");

  try {
    const res = await fetch(`https://gnews.io/api/v4/search?q=bourse+marchés+financiers&lang=fr&max=10&apikey=${apiKey}`, {
      next: { revalidate: 900 }, // cache 15 minutes
    });
    const data = await res.json();
    if (!res.ok) return unavailable(data.errors?.[0] ?? "Erreur GNews");

    // Same shape as the news route (NewsAPI format, read by the markets dashboard).
    const articles = ((data.articles ?? []) as GNewsArticle[])
      .filter((article) => article.url && article.title)
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
    return unavailable("GNews injoignable");
  }
}

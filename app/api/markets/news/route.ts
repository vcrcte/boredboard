import { NextResponse } from "next/server";

// NewsAPI treats space-separated words as AND, which returns nothing for a
// list of finance keywords, so the terms are combined with OR and matched
// against titles and descriptions only.
const QUERY =
  '"marchés financiers" OR "Wall Street" OR "CAC 40" OR "Bourse de Paris" OR "banque centrale" OR "Réserve fédérale" OR BCE';

export async function GET() {
  if (!process.env.NEWSAPI_KEY) {
    return NextResponse.json({ status: "error", message: "NEWSAPI_KEY manquante" }, { status: 500 });
  }

  try {
    const params = new URLSearchParams({
      q: QUERY,
      searchIn: "title,description",
      language: "fr",
      sortBy: "publishedAt",
      pageSize: "20",
      apiKey: process.env.NEWSAPI_KEY,
    });
    const res = await fetch(`https://newsapi.org/v2/everything?${params}`, { next: { revalidate: 300 } });
    const data = await res.json();

    if (!res.ok || data.status !== "ok") {
      return NextResponse.json({ status: "error", message: data.message ?? "Erreur NewsAPI" }, { status: 502 });
    }

    const articles = (data.articles ?? []).filter(
      (article: { title: string | null; url: string | null }) =>
        article.url && article.title && article.title !== "[Removed]",
    );
    return NextResponse.json({ status: "ok", articles });
  } catch {
    return NextResponse.json({ status: "error", message: "NewsAPI injoignable" }, { status: 502 });
  }
}

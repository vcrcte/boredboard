import { NextResponse } from "next/server";

export const revalidate = 300;

type NDArticle = {
  title: string | null;
  description: string | null;
  link: string | null;
  image_url: string | null;
  pubDate: string;
  source_name?: string;
  source_id?: string;
};

function unavailable(message: string) {
  return NextResponse.json({ status: "error", message, articles: [] });
}

export async function GET() {
  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) return unavailable("NEWSDATA_API_KEY manquante");

  try {
    const [resFr, resEn] = await Promise.all([
      fetch(
        `https://newsdata.io/api/1/latest?apikey=${apiKey}&category=business&language=fr`,
        { next: { revalidate: 300 } }
      ),
      fetch(
        `https://newsdata.io/api/1/latest?apikey=${apiKey}&category=business&language=en`,
        { next: { revalidate: 300 } }
      ),
    ]);

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
      .map((a) => ({
        title: a.title,
        description: a.description,
        url: a.link,
        urlToImage: a.image_url,
        // NewsData sends "2026-10-06 03:41:00" in UTC: as ISO, every browser (Safari included) reads it right.
        publishedAt: /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(a.pubDate) ? `${a.pubDate.replace(" ", "T")}Z` : a.pubDate,
        source: { name: a.source_name || a.source_id || "Source inconnue" },
        author: a.source_name ?? null,
      }));

    return NextResponse.json({ status: "ok", articles });
  } catch {
    return unavailable("NewsData injoignable");
  }
}

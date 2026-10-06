import { NextResponse } from "next/server";

export const revalidate = 300; // 5 minutes

type NDArticle = {
  title: string | null;
  description: string | null;
  link: string | null;
  image_url: string | null;
  pubDate: string;
  source_name?: string;
  source_id?: string;
};

const categoryMap: Record<string, string> = {
  general: "top",
  Actualités: "top",
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || "general";
  const query = searchParams.get("q") || "";

  const apiKey = process.env.NEWSDATA_API_KEY;
  if (!apiKey) return NextResponse.json({ status: "error", message: "NEWSDATA_API_KEY manquante", articles: [] });

  try {
    const params = new URLSearchParams({
      apikey: apiKey,
      language: "fr",
    });

    if (query) {
      params.set("q", query);
    } else {
      params.set("category", categoryMap[category] || "top");
    }

    const res = await fetch(`https://newsdata.io/api/1/latest?${params}`, {
      next: { revalidate: 300 },
    });
    const data = await res.json();

    if (data.status !== "success") {
      return NextResponse.json({ status: "error", message: data.results?.message ?? "Erreur NewsData", articles: [] });
    }

    const articles = ((data.results ?? []) as NDArticle[])
      .filter((a) => a.link && a.title && a.description)
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
    return NextResponse.json({ status: "error", message: "NewsData injoignable", articles: [] });
  }
}

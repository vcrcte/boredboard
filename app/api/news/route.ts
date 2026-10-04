import { NextResponse } from "next/server";

const NEWSAPI = "https://newsapi.org/v2";

const categoryMap: Record<string, string> = {
  Actualités: "general",
  Science: "science",
  Tech: "technology",
  Sport: "sports",
  Santé: "health",
};

// NewsAPI's top-headlines endpoint returns nothing in French, so each category
// falls back to the /everything endpoint: the latest articles of the main
// French outlets for the general feed, a keyword search for the others.
const GENERAL_DOMAINS = [
  "lemonde.fr",
  "lefigaro.fr",
  "liberation.fr",
  "francetvinfo.fr",
  "bfmtv.com",
  "20minutes.fr",
  "lexpress.fr",
  "leparisien.fr",
  "ouest-france.fr",
  "huffingtonpost.fr",
  "courrierinternational.com",
  "lesechos.fr",
  "mediapart.fr",
  "lepoint.fr",
  "nouvelobs.com",
].join(",");

const fallbackQueries: Record<string, string> = {
  science: "science",
  technology: "technologie",
  sports: "sport",
  health: "santé",
};

type NewsApiResponse = {
  status: string;
  message?: string;
  articles?: { title: string | null; description: string | null; url: string | null }[];
};

async function fetchNews(path: string): Promise<{ ok: boolean; data: NewsApiResponse }> {
  const res = await fetch(`${NEWSAPI}/${path}&apiKey=${process.env.NEWSAPI_KEY}`, {
    next: { revalidate: 300 },
  });
  const data = (await res.json()) as NewsApiResponse;
  return { ok: res.ok && data.status === "ok", data };
}

const everything = (query: string) =>
  `everything?q=${encodeURIComponent(query)}&language=fr&sortBy=publishedAt&pageSize=20`;

export async function GET(request: Request) {
  if (!process.env.NEWSAPI_KEY) {
    return NextResponse.json({ status: "error", message: "NEWSAPI_KEY manquante" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get("category") || "general";
  const query = searchParams.get("q") || "";
  const apiCategory = categoryMap[category] || "general";

  try {
    let result = await fetchNews(
      query
        ? everything(query)
        : `top-headlines?language=fr&category=${apiCategory}&pageSize=20`,
    );

    if (!query && result.ok && (result.data.articles?.length ?? 0) === 0) {
      result = await fetchNews(
        apiCategory === "general"
          ? `everything?domains=${GENERAL_DOMAINS}&language=fr&sortBy=publishedAt&pageSize=20`
          : everything(fallbackQueries[apiCategory]),
      );
    }

    if (!result.ok) {
      return NextResponse.json(
        { status: "error", message: result.data.message ?? "Erreur NewsAPI" },
        { status: 502 },
      );
    }

    // NewsAPI keeps withdrawn articles as "[Removed]" placeholders; articles
    // without a description have nothing to show beyond their title.
    const articles = (result.data.articles ?? []).filter(
      (article) => article.url && article.title && article.title !== "[Removed]" && article.description,
    );
    return NextResponse.json({ status: "ok", articles });
  } catch {
    return NextResponse.json({ status: "error", message: "NewsAPI injoignable" }, { status: 502 });
  }
}

import { NextResponse } from "next/server";
import { NEWSLETTER_SOURCES } from "@/lib/newsletter";

export const revalidate = 900; // 15-minute cache

type FeedArticle = {
  title: string;
  description: string;
  url: string;
  source_id: string;
  source_name: string;
  source_icon: string;
  source_color: string;
  theme: string;
  published_at: string;
};

/**
 * GET /api/newsletters?sources=le-grand-continent,science-etonnante,...
 *
 * Fetches RSS/Atom feeds for the requested newsletter sources and returns
 * the latest articles as JSON. Sources without a feed_url are skipped.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sourceIds = (searchParams.get("sources") ?? "").split(",").filter(Boolean);

  if (sourceIds.length === 0) {
    return NextResponse.json({ articles: [] });
  }

  const sources = NEWSLETTER_SOURCES.filter(
    (s) => sourceIds.includes(s.id) && s.feed_url,
  );

  if (sources.length === 0) {
    return NextResponse.json({ articles: [] });
  }

  const allArticles: FeedArticle[] = [];

  await Promise.allSettled(
    sources.map(async (source) => {
      try {
        const res = await fetch(source.feed_url!, {
          next: { revalidate: 900 },
          headers: { "User-Agent": "BoredBoard/1.0" },
        });
        if (!res.ok) return;

        const xml = await res.text();
        const items = parseRssItems(xml, 5);

        for (const item of items) {
          allArticles.push({
            title: item.title,
            description: item.description,
            url: item.link,
            source_id: source.id,
            source_name: source.name,
            source_icon: source.icon,
            source_color: source.color,
            theme: source.theme,
            published_at: item.pubDate,
          });
        }
      } catch {
        // Silently skip failing feeds
      }
    }),
  );

  // Sort by date descending, take the 10 most recent
  allArticles.sort(
    (a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime(),
  );

  return NextResponse.json({ articles: allArticles.slice(0, 10) });
}

// ── Minimal RSS/Atom parser ───────────────────────────────────────────

type RssItem = { title: string; description: string; link: string; pubDate: string };

function parseRssItems(xml: string, limit: number): RssItem[] {
  const items: RssItem[] = [];

  // Try RSS 2.0 <item> first
  const rssItemRegex = /<item[\s>]([\s\S]*?)<\/item>/gi;
  let match: RegExpExecArray | null;

  while ((match = rssItemRegex.exec(xml)) !== null && items.length < limit) {
    const block = match[1];
    items.push({
      title: extractTag(block, "title"),
      description: truncate(stripHtml(extractTag(block, "description") || extractTag(block, "content:encoded")), 200),
      link: extractTag(block, "link") || extractAttr(block, "link", "href"),
      pubDate: extractTag(block, "pubDate") || extractTag(block, "dc:date") || new Date().toISOString(),
    });
  }

  // Fallback to Atom <entry>
  if (items.length === 0) {
    const atomRegex = /<entry[\s>]([\s\S]*?)<\/entry>/gi;
    while ((match = atomRegex.exec(xml)) !== null && items.length < limit) {
      const block = match[1];
      items.push({
        title: extractTag(block, "title"),
        description: truncate(stripHtml(extractTag(block, "summary") || extractTag(block, "content")), 200),
        link: extractAttr(block, "link", "href") || extractTag(block, "link"),
        pubDate: extractTag(block, "published") || extractTag(block, "updated") || new Date().toISOString(),
      });
    }
  }

  return items;
}

function extractTag(xml: string, tag: string): string {
  // Match <tag>content</tag> or <tag ...>content</tag>, handling CDATA
  const regex = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?</${tag}>`, "i");
  const m = regex.exec(xml);
  return m ? m[1].trim() : "";
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const regex = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, "i");
  const m = regex.exec(xml);
  return m ? m[1] : "";
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/\s+/g, " ").trim();
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

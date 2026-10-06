import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/og?url=<encoded-url>
 *
 * Fetches Open Graph metadata (title, description, image) from a URL.
 * Used by the dashboard to display rich link previews.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return NextResponse.json({ error: "Invalid URL protocol" }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "BoredBoard/1.0 (link preview)",
        Accept: "text/html",
      },
    });
    clearTimeout(timeout);

    if (!res.ok) {
      return NextResponse.json({ error: "Failed to fetch URL" }, { status: 502 });
    }

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return NextResponse.json({ error: "Not an HTML page" }, { status: 422 });
    }

    // Read first 50KB only to avoid downloading huge pages
    const reader = res.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: "No response body" }, { status: 502 });
    }

    let html = "";
    const decoder = new TextDecoder();
    let done = false;
    while (!done && html.length < 50000) {
      const { value, done: d } = await reader.read();
      done = d;
      if (value) html += decoder.decode(value, { stream: true });
    }
    reader.cancel();

    // Parse OG tags with regex (no DOM parser needed for simple extraction)
    const getMeta = (property: string): string | null => {
      // Match og:title, og:description, og:image, twitter:title, etc.
      const patterns = [
        new RegExp(`<meta[^>]*property=["']${property}["'][^>]*content=["']([^"']*)["']`, "i"),
        new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*property=["']${property}["']`, "i"),
        new RegExp(`<meta[^>]*name=["']${property}["'][^>]*content=["']([^"']*)["']`, "i"),
        new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${property}["']`, "i"),
      ];
      for (const p of patterns) {
        const m = p.exec(html);
        if (m?.[1]) return m[1].trim();
      }
      return null;
    };

    const title =
      getMeta("og:title") ??
      getMeta("twitter:title") ??
      (/<title[^>]*>([^<]*)<\/title>/i.exec(html)?.[1]?.trim() ?? null);

    const description =
      getMeta("og:description") ??
      getMeta("twitter:description") ??
      getMeta("description");

    const image =
      getMeta("og:image") ??
      getMeta("twitter:image");

    const siteName = getMeta("og:site_name");

    // Resolve relative image URLs
    let resolvedImage = image;
    if (image && !image.startsWith("http")) {
      try {
        resolvedImage = new URL(image, url).href;
      } catch {
        resolvedImage = null;
      }
    }

    const domain = new URL(url).hostname.replace(/^www\./, "");

    return NextResponse.json(
      { title, description, image: resolvedImage, siteName, domain },
      {
        headers: {
          "Cache-Control": "public, max-age=3600, s-maxage=86400",
        },
      },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

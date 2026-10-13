import type { IncomingMessage } from "node:http";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { clientForRequest } from "@/lib/supabase-server";
import { isPrivateAddress, publicOnlyLookup } from "@/lib/ssrf";

const MAX_REDIRECTS = 3;
const MAX_HTML_CHARS = 50000;

/** Rejects non-http(s) URLs and private IP literals (hostnames are checked at connect time). */
function isAllowedUrl(url: URL): boolean {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  return !isIP(host) || !isPrivateAddress(host);
}

/** One GET without following redirects. DNS goes through publicOnlyLookup. */
function requestPage(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
  const get = url.protocol === "https:" ? httpsGet : httpGet;
  return new Promise((resolve, reject) => {
    get(url, {
      lookup: publicOnlyLookup,
      signal,
      headers: { "User-Agent": "BoredBoard/1.0 (link preview)", Accept: "text/html" },
    }, resolve).on("error", reject);
  });
}

/**
 * GET /api/og?url=<encoded-url>
 *
 * Fetches Open Graph metadata (title, description, image) from a URL.
 * Used by the dashboard to display rich link previews. Signed-in users only,
 * and only public hosts, so the route cannot be used as an open proxy.
 */
export async function GET(request: NextRequest) {
  if (!(await clientForRequest(request))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = request.nextUrl.searchParams.get("url");
  if (!url) {
    return NextResponse.json({ error: "Missing url parameter" }, { status: 400 });
  }

  let target: URL;
  try {
    target = new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    // Follow redirects by hand so every hop is checked against private hosts.
    let res: IncomingMessage | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!isAllowedUrl(target)) {
        return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
      }
      res = await requestPage(target, controller.signal);
      const status = res.statusCode ?? 0;
      const location = res.headers.location;
      if (status < 300 || status >= 400 || !location) break;
      res.destroy();
      target = new URL(location, target);
      res = null;
    }

    if (!res) {
      return NextResponse.json({ error: "Too many redirects" }, { status: 502 });
    }
    const status = res.statusCode ?? 0;
    if (status < 200 || status >= 300) {
      res.destroy();
      return NextResponse.json({ error: "Failed to fetch URL" }, { status: 502 });
    }

    const contentType = res.headers["content-type"] ?? "";
    if (!contentType.includes("text/html")) {
      res.destroy();
      return NextResponse.json({ error: "Not an HTML page" }, { status: 422 });
    }

    // Read the first 50KB only to avoid downloading huge pages
    let html = "";
    res.setEncoding("utf8");
    for await (const chunk of res) {
      html += chunk;
      if (html.length >= MAX_HTML_CHARS) break;
    }
    res.destroy();

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
        resolvedImage = new URL(image, target).href;
      } catch {
        resolvedImage = null;
      }
    }

    const domain = new URL(url).hostname.replace(/^www\./, "");

    return NextResponse.json(
      { title, description, image: resolvedImage, siteName, domain },
      {
        headers: {
          // Private: a shared CDN cache would answer without checking the login.
          "Cache-Control": "private, max-age=3600",
        },
      },
    );
  } catch (err) {
    if ((err as { code?: string }).code === "EPRIVATE") {
      return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
    }
    // Don't echo the error: it can name internal hosts or addresses.
    return NextResponse.json({ error: "Failed to fetch preview" }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}

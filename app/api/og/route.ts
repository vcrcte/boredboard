import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { NextRequest, NextResponse } from "next/server";
import { clientForRequest } from "@/lib/supabase-server";

const MAX_REDIRECTS = 3;

/** True for loopback, private, link-local, CGNAT and other non-public ranges. */
function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 6) {
    const a = address.toLowerCase();
    if (a.startsWith("::ffff:")) return isPrivateAddress(a.slice(7));
    return a === "::" || a === "::1" || a.startsWith("fc") || a.startsWith("fd") || a.startsWith("fe80");
  }
  const [x, y] = address.split(".").map(Number);
  return (
    x === 0 ||
    x === 10 ||
    x === 127 ||
    (x === 100 && y >= 64 && y <= 127) ||
    (x === 169 && y === 254) ||
    (x === 172 && y >= 16 && y <= 31) ||
    (x === 192 && y === 168) ||
    x >= 224
  );
}

/** Rejects non-http(s) URLs and hosts that resolve to a non-public address. */
async function isPublicHttpUrl(url: URL): Promise<boolean> {
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  try {
    const addresses = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
    return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
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

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    // Follow redirects by hand so every hop is checked against private hosts.
    let res: Response | null = null;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      if (!(await isPublicHttpUrl(target))) {
        clearTimeout(timeout);
        return NextResponse.json({ error: "URL not allowed" }, { status: 400 });
      }
      res = await fetch(target, {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "BoredBoard/1.0 (link preview)",
          Accept: "text/html",
        },
      });
      const location = res.headers.get("location");
      if (res.status < 300 || res.status >= 400 || !location) break;
      target = new URL(location, target);
      res = null;
    }
    clearTimeout(timeout);

    if (!res) {
      return NextResponse.json({ error: "Too many redirects" }, { status: 502 });
    }
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
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

import { NextResponse } from "next/server";
import { LASTFM_USERNAME } from "@/lib/lastfm";

// Only these read-only methods can be proxied with the server's API key.
const METHODS = new Set(["user.getrecenttracks", "user.gettoptracks", "user.getinfo"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username") ?? "";
  const method = searchParams.get("method") || "user.getrecenttracks";
  const limit = Math.min(10, Math.max(1, Number(searchParams.get("limit")) || 5));
  const period = searchParams.get("period");

  if (!username) return NextResponse.json({ error: "Username required" }, { status: 400 });
  if (!LASTFM_USERNAME.test(username)) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }
  if (!METHODS.has(method)) return NextResponse.json({ error: "Unsupported method" }, { status: 400 });
  if (!process.env.LASTFM_API_KEY) {
    return NextResponse.json({ error: "Missing key", message: "LASTFM_API_KEY manquante" }, { status: 500 });
  }

  const params = new URLSearchParams({
    method,
    user: username,
    api_key: process.env.LASTFM_API_KEY,
    format: "json",
    limit: String(limit),
  });
  if (period && method === "user.gettoptracks") params.set("period", period);

  try {
    const res = await fetch(`https://ws.audioscrobbler.com/2.0/?${params}`, { next: { revalidate: 30 } });
    const data = await res.json();
    // Last.fm reports errors (unknown user, bad key…) as { error: <code>, message }.
    if (!res.ok || data.error) {
      const status = data.error === 6 ? 404 : 502;
      return NextResponse.json({ error: data.error ?? "Last.fm error", message: data.message ?? "Erreur Last.fm" }, { status });
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Unreachable", message: "Last.fm injoignable" }, { status: 502 });
  }
}

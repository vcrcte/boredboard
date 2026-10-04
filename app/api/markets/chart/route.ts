import { NextResponse } from "next/server";
import { SYMBOL_PATTERN } from "@/lib/markets";

// Period selector → Yahoo range and sampling interval.
const PERIODS: Record<string, { range: string; interval: string }> = {
  "1J": { range: "1d", interval: "5m" },
  "1S": { range: "5d", interval: "30m" },
  "1M": { range: "1mo", interval: "1d" },
  "3M": { range: "3mo", interval: "1d" },
  "1A": { range: "1y", interval: "1wk" },
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = (searchParams.get("symbol") ?? "").toUpperCase();
  const period = PERIODS[searchParams.get("period") ?? "1J"];

  if (!SYMBOL_PATTERN.test(symbol) || !period) {
    return NextResponse.json({ error: "Paramètres invalides" }, { status: 400 });
  }

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${period.interval}&range=${period.range}`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 60 } },
    );
    const result = res.ok ? (await res.json())?.chart?.result?.[0] : null;
    const timestamps: number[] = result?.timestamp ?? [];
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];

    // Yahoo leaves holes in the series (null closes); they are dropped.
    const points = timestamps
      .map((timestamp, index) => ({ t: timestamp * 1000, price: closes[index] }))
      .filter((point): point is { t: number; price: number } => typeof point.price === "number");

    if (points.length < 2) {
      return NextResponse.json({ error: "Historique indisponible" }, { status: 502 });
    }

    return NextResponse.json({
      points,
      // The close just before the period starts: the chart's reference line.
      reference: result.meta?.chartPreviousClose ?? points[0].price,
    });
  } catch {
    return NextResponse.json({ error: "Historique indisponible" }, { status: 502 });
  }
}

import { NextResponse } from "next/server";

// Daily history of the main indices over the last month: the latest sessions'
// performance and the traded volumes shown in the "Bourse" section of /actualites.

const INDICES = [
  { symbol: "^FCHI", name: "CAC 40" },
  { symbol: "^GSPC", name: "S&P 500" },
  { symbol: "^IXIC", name: "Nasdaq" },
];

type Session = { date: string; close: number; volume: number; changePercent: number };

async function fetchSessions(symbol: string): Promise<Session[]> {
  const res = await fetch(
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=1mo`,
    { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 300 } },
  );
  if (!res.ok) return [];
  const result = (await res.json())?.chart?.result?.[0];
  const timestamps: number[] = result?.timestamp ?? [];
  const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close ?? [];
  const volumes: (number | null)[] = result?.indicators?.quote?.[0]?.volume ?? [];
  // Dates are read in the exchange's own time zone, so a US session isn't shifted to the next day.
  const offsetMs = (result?.meta?.gmtoffset ?? 0) * 1000;

  const days = timestamps
    .map((timestamp, index) => ({
      date: new Date(timestamp * 1000 + offsetMs).toISOString().slice(0, 10),
      close: closes[index],
      volume: volumes[index] ?? 0,
    }))
    .filter((day): day is { date: string; close: number; volume: number } => typeof day.close === "number");

  return days.slice(1).map((day, index) => ({
    ...day,
    changePercent: ((day.close - days[index].close) / days[index].close) * 100,
  }));
}

export async function GET() {
  try {
    const today = new Date().toISOString().slice(0, 10);
    // Only finished sessions: today's bar is partial (and has no volume yet for some indices).
    const [cac, sp, nasdaq] = await Promise.all(
      INDICES.map(async (index) => (await fetchSessions(index.symbol)).filter((session) => session.date < today)),
    );

    if (cac.length === 0 && sp.length === 0) {
      return NextResponse.json({ error: "Historique indisponible" }, { status: 502 });
    }

    const spByDate = new Map(sp.map((session) => [session.date, session.changePercent]));
    const sessions = cac
      .slice(-5)
      .reverse()
      .map((session) => ({ date: session.date, cac: session.changePercent, sp: spByDate.get(session.date) ?? null }));

    const volumes = [cac, sp, nasdaq]
      .map((series, index) => {
        const withVolume = series.filter((session) => session.volume > 0);
        const last = withVolume[withVolume.length - 1];
        if (!last) return null;
        return {
          name: INDICES[index].name,
          date: last.date,
          volume: last.volume,
          // Share of the busiest session of the month, for the bar.
          percentOfMax: Math.round((last.volume / Math.max(...withVolume.map((session) => session.volume))) * 100),
        };
      })
      .filter((item) => item !== null);

    return NextResponse.json({ sessions, volumes });
  } catch {
    return NextResponse.json({ error: "Historique indisponible" }, { status: 502 });
  }
}

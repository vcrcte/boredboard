import { NextResponse } from "next/server";
import { SYMBOL_PATTERN, type MarketGroups, type Quote, type QuoteKind } from "@/lib/markets";

type Instrument = { symbol: string; name: string; detail?: string };

const GROUPS: Record<keyof MarketGroups, { kind: QuoteKind; instruments: Instrument[] }> = {
  indices: {
    kind: "index",
    instruments: [
      { symbol: "^FCHI", name: "CAC 40", detail: "France" },
      { symbol: "^GSPC", name: "S&P 500", detail: "États-Unis" },
      { symbol: "^DJI", name: "Dow Jones", detail: "États-Unis" },
      { symbol: "^IXIC", name: "Nasdaq", detail: "États-Unis" },
      { symbol: "^FTSE", name: "FTSE 100", detail: "Royaume-Uni" },
      { symbol: "^N225", name: "Nikkei 225", detail: "Japon" },
    ],
  },
  stocksFr: {
    kind: "stock",
    instruments: [
      { symbol: "BNP.PA", name: "BNP Paribas" },
      { symbol: "AI.PA", name: "Air Liquide" },
      { symbol: "TTE.PA", name: "TotalEnergies" },
      { symbol: "MC.PA", name: "LVMH" },
      { symbol: "OR.PA", name: "L'Oréal" },
      { symbol: "SAN.PA", name: "Sanofi" },
      { symbol: "AIR.PA", name: "Airbus" },
      { symbol: "SU.PA", name: "Schneider Electric" },
      { symbol: "RMS.PA", name: "Hermès" },
      { symbol: "CAP.PA", name: "Capgemini" },
    ],
  },
  stocksUs: {
    kind: "stock",
    instruments: [
      { symbol: "AAPL", name: "Apple" },
      { symbol: "MSFT", name: "Microsoft" },
      { symbol: "NVDA", name: "Nvidia" },
      { symbol: "GOOGL", name: "Alphabet" },
      { symbol: "AMZN", name: "Amazon" },
      { symbol: "META", name: "Meta" },
      { symbol: "TSLA", name: "Tesla" },
      { symbol: "JPM", name: "JPMorgan Chase" },
      { symbol: "V", name: "Visa" },
      { symbol: "BRK-B", name: "Berkshire Hathaway" },
    ],
  },
  fx: {
    kind: "fx",
    instruments: [
      { symbol: "EURUSD=X", name: "EUR/USD" },
      { symbol: "GBPUSD=X", name: "GBP/USD" },
      { symbol: "USDJPY=X", name: "USD/JPY" },
      { symbol: "EURGBP=X", name: "EUR/GBP" },
    ],
  },
  rates: {
    kind: "rate",
    instruments: [
      { symbol: "^TNX", name: "US 10 ans" },
      { symbol: "^TYX", name: "US 30 ans" },
      { symbol: "^IRX", name: "US 3 mois" },
    ],
  },
  commodities: {
    kind: "commodity",
    instruments: [
      { symbol: "GC=F", name: "Or" },
      { symbol: "CL=F", name: "Pétrole WTI" },
      { symbol: "SI=F", name: "Argent" },
      { symbol: "NG=F", name: "Gaz naturel" },
    ],
  },
  crypto: {
    kind: "stock",
    instruments: [
      { symbol: "BTC-USD", name: "Bitcoin" },
      { symbol: "ETH-USD", name: "Ethereum" },
      { symbol: "SOL-USD", name: "Solana" },
      { symbol: "BNB-USD", name: "BNB" },
    ],
  },
  sectors: {
    kind: "stock",
    instruments: [
      { symbol: "XLF", name: "Finance", detail: "🏦" },
      { symbol: "XLV", name: "Santé", detail: "💊" },
      { symbol: "XLE", name: "Énergie", detail: "⚡" },
      { symbol: "XLK", name: "Tech", detail: "🖥️" },
      { symbol: "XLI", name: "Industrie", detail: "🏗️" },
      { symbol: "XLY", name: "Conso.", detail: "🛒" },
    ],
  },
  fxExotic: {
    kind: "fx",
    instruments: [
      { symbol: "USDCHF=X", name: "USD/CHF" },
      { symbol: "USDCAD=X", name: "USD/CAD" },
      { symbol: "AUDUSD=X", name: "AUD/USD" },
      { symbol: "USDCNY=X", name: "USD/CNY" },
    ],
  },
  volatility: {
    // Quoted in points with decimals, unlike the equity indices.
    kind: "stock",
    instruments: [{ symbol: "^VIX", name: "VIX" }],
  },
};

const KNOWN = new Map(
  Object.values(GROUPS).flatMap((group) =>
    group.instruments.map((instrument) => [instrument.symbol, { ...instrument, kind: group.kind }] as const),
  ),
);

const YAHOO_KINDS: Record<string, QuoteKind> = {
  INDEX: "index",
  CURRENCY: "fx",
  FUTURE: "commodity",
};

async function fetchQuote(symbol: string): Promise<Quote | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=30m&range=1d`,
      { headers: { "User-Agent": "Mozilla/5.0" }, next: { revalidate: 60 } },
    );
    if (!res.ok) return null;
    const result = (await res.json())?.chart?.result?.[0];
    const meta = result?.meta;
    const price = meta?.regularMarketPrice;
    const previousClose = meta?.chartPreviousClose ?? meta?.previousClose;
    if (typeof price !== "number" || typeof previousClose !== "number") return null;

    // The chart endpoint doesn't return the day's change, so it is derived
    // from the previous close.
    const change = price - previousClose;
    const known = KNOWN.get(symbol);
    // Today's 30-minute closes, for the sparkline (gaps in the series are dropped).
    const closes: unknown[] = result?.indicators?.quote?.[0]?.close ?? [];
    const spark = closes.filter((value): value is number => typeof value === "number").slice(-20);
    return {
      symbol,
      name: known?.name ?? meta.shortName ?? meta.longName ?? symbol,
      detail: known?.detail,
      kind: known?.kind ?? YAHOO_KINDS[meta.instrumentType] ?? "stock",
      price,
      change,
      changePercent: previousClose ? (change / previousClose) * 100 : 0,
      previousClose,
      currency: meta.currency ?? null,
      spark,
    };
  } catch {
    return null;
  }
}

async function fetchQuotes(symbols: string[]) {
  return (await Promise.all(symbols.map(fetchQuote))).filter((quote): quote is Quote => quote !== null);
}

export async function GET(request: Request) {
  // `?symbols=AAPL,NVDA` returns just those quotes (used by the watchlist).
  const requested = new URL(request.url).searchParams.get("symbols");
  if (requested !== null) {
    const symbols = Array.from(new Set(requested.split(",").map((symbol) => symbol.trim().toUpperCase())))
      .filter((symbol) => SYMBOL_PATTERN.test(symbol))
      .slice(0, 20);
    return NextResponse.json({ quotes: await fetchQuotes(symbols), updatedAt: new Date().toISOString() });
  }

  const entries = await Promise.all(
    (Object.keys(GROUPS) as (keyof MarketGroups)[]).map(
      async (key) => [key, await fetchQuotes(GROUPS[key].instruments.map((item) => item.symbol))] as const,
    ),
  );
  const groups = Object.fromEntries(entries) as MarketGroups;

  if (Object.values(groups).every((quotes) => quotes.length === 0)) {
    return NextResponse.json({ error: "Cotations indisponibles" }, { status: 502 });
  }
  return NextResponse.json({ ...groups, updatedAt: new Date().toISOString() });
}

export type QuoteKind = "index" | "stock" | "fx" | "commodity" | "rate";

export type Quote = {
  symbol: string;
  /** Display name, e.g. "CAC 40" or "Apple". */
  name: string;
  /** Secondary label, e.g. the country of an index. */
  detail?: string;
  kind: QuoteKind;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  currency: string | null;
  /** Today's intraday closes, oldest first; may be empty outside trading hours. */
  spark?: number[];
};

export type MarketGroups = {
  indices: Quote[];
  stocksFr: Quote[];
  stocksUs: Quote[];
  fx: Quote[];
  rates: Quote[];
  commodities: Quote[];
  /** The VIX, shown in the market sentiment block. */
  volatility: Quote[];
  crypto: Quote[];
  /** US sector ETFs (SPDR), used as sector indices. */
  sectors: Quote[];
  fxExotic: Quote[];
};

export type MarketsResponse = MarketGroups & { updatedAt: string };

const UP = "#16A34A";
const DOWN = "#DC2626";
const FLAT = "rgba(28,26,21,0.4)";

/** Indices are shown without decimals, everything else with two. */
export function formatPrice(quote: Pick<Quote, "kind" | "price">) {
  const decimals = quote.kind === "index" ? 0 : 2;
  const price = quote.price.toLocaleString("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return quote.kind === "rate" ? `${price} %` : price;
}

export function formatPercent(value: number) {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
}

export function formatChange(quote: Pick<Quote, "kind" | "change">) {
  const decimals = quote.kind === "index" ? 0 : 2;
  const sign = quote.change > 0 ? "+" : "";
  return `${sign}${quote.change.toLocaleString("fr-FR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function changeColor(value: number) {
  // Compare on the rounded percentage, so "0,00 %" is never shown in green or red.
  const rounded = Math.round(value * 100) / 100;
  if (rounded > 0) return UP;
  if (rounded < 0) return DOWN;
  return FLAT;
}

export const SYMBOL_PATTERN = /^[A-Z0-9.^=-]{1,12}$/;

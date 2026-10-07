"use client";

import { useCallback, useEffect, useId, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { Area, AreaChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import ArticleReader from "@/components/ArticleReader";
import { ShareModal } from "@/components/NewsCard";
import {
  SYMBOL_PATTERN,
  formatChange,
  formatPercent,
  formatPrice,
  type MarketsResponse,
  type Quote,
} from "@/lib/markets";
import type { NewsArticle } from "@/lib/news";
import {
  loadPortfolio,
  addPortfolioPosition,
  removePortfolioPosition,
  loadAlerts,
  addAlert,
  removeAlert,
  type PortfolioPosition,
  type PriceAlert,
} from "@/lib/user-markets";

// The "Bourse" section of /actualites: quotes, charts and market news for a
// signed-in reader. Light cream palette; only the ticker band stays dark.
const BG = "#F7F4EE";
const PAGE_GRADIENT = "linear-gradient(180deg, #F7F4EE 0%, #EEE8DC 40%, #F0EBE1 100%)";
const SURFACE = "#FFFFFF";
const TICKER_BG = "#1C1A15";
const INDIGO = "#2A3560";
const UP = "#16A34A";
const DOWN = "#DC2626";
const GOLD = "#C4A94A";
const TEXT = "#1C1A15";
const ACCENT = "#4A6CF7";
const BORDER = "rgba(0,0,0,0.07)";
const MONO = "ui-monospace, SFMono-Regular, Menlo, monospace";
const GEORGIA = "Georgia, 'Times New Roman', serif";

const text = (alpha: number) => `rgba(28,26,21,${alpha})`;
const black = (alpha: number) => `rgba(0,0,0,${alpha})`;
const accent = (alpha: number) => `rgba(74,108,247,${alpha})`;
const DIM = text(0.4);

const REFRESH_MS = 60_000;
const WATCHLIST_KEY = "boredboard:watchlist";
const DEFAULT_WATCHLIST = ["AAPL", "NVDA", "MSFT", "BNP.PA", "TTE.PA", "EURUSD=X", "GC=F", "ETH-USD", "^FCHI", "AMZN"];
const HERO_SYMBOLS = ["^FCHI", "^GSPC", "^DJI", "^IXIC", "^N225"];
const STOCKS_SHOWN = 8;
const HERO_HEIGHT = 140;
// Most recent dispatches pinned at the top of the news wire.
const TOP_WIRE = 3;

const chartAssets = [
  { symbol: "^FCHI", label: "CAC 40", decimals: 0 },
  { symbol: "^GSPC", label: "S&P 500", decimals: 0 },
  { symbol: "EURUSD=X", label: "EUR/USD", decimals: 4 },
  { symbol: "GC=F", label: "Or", decimals: 2 },
  { symbol: "BNP.PA", label: "BNP.PA", decimals: 2 },
];
const chartPeriods = ["1J", "1S", "1M", "3M", "1A"] as const;
type ChartPeriod = (typeof chartPeriods)[number];
type ChartData = { points: { t: number; price: number }[]; reference: number };
type MarketHistory = {
  sessions: { date: string; cac: number; sp: number | null }[];
  volumes: { name: string; date: string; volume: number; percentOfMax: number }[];
};

// Hover states and keyframes can't be expressed as inline styles. No quotes in
// here: React escapes them when rendering a <style> on the server.
const css = `
.mk-ticker { display: flex; width: max-content; animation: mk-scroll 40s linear infinite; }
.mk-ticker:hover { animation-play-state: paused; }
@keyframes mk-scroll { from { transform: translateX(0); } to { transform: translateX(-50%); } }
.mk-pulse { animation: mk-pulse 2s infinite; }
@keyframes mk-pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.45; transform: scale(1.5); } }
.mk-hover { color: ${DIM}; transition: color 0.15s; }
.mk-hover:hover { color: ${TEXT}; }
.mk-pill { background: ${black(0.05)}; color: ${text(0.55)}; transition: background-color 0.15s; }
.mk-pill:hover { background: ${black(0.09)}; }
.mk-line { transition: background-color 0.15s; }
.mk-line:hover { background: ${BG}; }
.mk-cols { display: flex; gap: 16px; align-items: stretch; padding: 24px 32px; }
.mk-col { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
/* Columns stretch to the tallest one; the last card of each absorbs the difference. */
.mk-col > :last-child { flex: 1; }
.mk-col-1 { flex: 1 1 0; }
/* Actions and Top news take the remaining width; Forex, rates and commodities keep a narrow column. */
.mk-col-2 { flex: 1 1 0; }
.mk-col-3 { flex: 1 1 0; }
.mk-col-4 { flex: 1 1 0; }
@media (max-width: 1199px) {
  .mk-cols { flex-wrap: wrap; }
  .mk-col-1, .mk-col-2, .mk-col-3, .mk-col-4 { flex: 1 1 calc(50% - 8px); }
}
@media (max-width: 768px) {
  .mk-cols { flex-direction: column; padding: 20px; }
  .mk-col-1, .mk-col-2, .mk-col-3, .mk-col-4 { flex: 1 1 auto; width: 100%; }
}
.mk-noscrollbar { scrollbar-width: none; }
.mk-noscrollbar::-webkit-scrollbar { display: none; }
.mk-input::placeholder { color: ${text(0.3)}; }
.mk-input:focus { border-color: ${accent(0.4)}; }
@media (prefers-reduced-motion: reduce) { .mk-ticker, .mk-pulse { animation: none; } }
`;

const panel: CSSProperties = {
  background: SURFACE,
  border: `1px solid ${BORDER}`,
  borderRadius: 14,
  padding: 20,
};

function changeColor(value: number) {
  // Compare on the rounded percentage, so "0,00 %" is never shown in green or red.
  const rounded = Math.round(value * 100) / 100;
  return rounded > 0 ? UP : rounded < 0 ? DOWN : DIM;
}

/** Today's intraday closes; a flat previous-close → price segment when the series is too short. */
function sparkData(quote: Quote) {
  const series = quote.spark && quote.spark.length > 1 ? quote.spark : [quote.previousClose, quote.price];
  return series.map((v, i) => ({ i, v }));
}

function Label({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <h2 className={className} style={{ fontSize: 9, color: text(0.3), letterSpacing: "0.12em", textTransform: "uppercase", fontWeight: 400 }}>
      {children}
    </h2>
  );
}

function Divider({ className = "my-3" }: { className?: string }) {
  return <div className={className} style={{ height: 1, background: black(0.06) }} />;
}

function PulseDot({ color = UP, size = 6, className = "" }: { color?: string; size?: number; className?: string }) {
  return <span aria-hidden className={`mk-pulse shrink-0 ${className}`} style={{ width: size, height: size, background: color, borderRadius: "50%" }} />;
}

function MiniSparkline({ quote, width = 60, height = 24 }: { quote: Quote; width?: number; height?: number }) {
  return (
    <span aria-hidden className="shrink-0" style={{ width, height }}>
      <LineChart width={width} height={height} data={sparkData(quote)} margin={{ top: 2, right: 1, bottom: 2, left: 1 }}>
        {/* Without this the axis starts at zero and every line looks flat. */}
        <YAxis hide domain={["dataMin", "dataMax"]} />
        <Line type="monotone" dataKey="v" stroke={quote.changePercent >= 0 ? UP : DOWN} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </span>
  );
}

function HeroIndex({ quote }: { quote: Quote }) {
  const rising = quote.changePercent >= 0;
  return (
    <div className="flex flex-col" style={{ background: SURFACE, padding: "14px 20px 0", height: HERO_HEIGHT }}>
      <p style={{ fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: "0.06em" }}>{quote.name}</p>
      <p className="flex flex-wrap items-baseline gap-x-2 overflow-hidden" style={{ fontVariantNumeric: "tabular-nums", height: 34 }}>
        <span style={{ fontFamily: GEORGIA, fontSize: 24, color: TEXT }}>{formatPrice(quote)}</span>
        <span style={{ fontSize: 13, color: changeColor(quote.changePercent) }}>{formatPercent(quote.changePercent)}</span>
        <span style={{ fontSize: 11, color: DIM }}>{formatChange(quote)} pts</span>
      </p>
      <div aria-hidden className="mt-auto" style={{ height: 60 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sparkData(quote)} margin={{ top: 2, right: 0, bottom: 0, left: 0 }}>
            <YAxis hide domain={["dataMin", "dataMax"]} />
            <Area
              type="monotone"
              dataKey="v"
              baseValue="dataMin"
              stroke={rising ? UP : DOWN}
              strokeWidth={1.5}
              fill={rising ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.06)"}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function QuoteRow({
  quote,
  variant,
  last,
  spark,
  padding = "9px 0",
  onRemove,
}: {
  quote: Quote;
  /** "index" shows name + country; "ticker" leads with the symbol; "plain" shows the name only. */
  variant: "index" | "ticker" | "plain";
  last: boolean;
  spark: { width: number; height: number };
  padding?: string;
  onRemove?: () => void;
}) {
  return (
    <li className="flex items-center justify-between gap-2" style={{ padding, borderBottom: last ? "none" : `1px solid ${black(0.05)}` }}>
      <div className="min-w-0 flex-1">
        {variant === "index" ? (
          <>
            <p className="truncate" style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>{quote.name}</p>
            <p style={{ fontSize: 10, color: DIM }}>{quote.detail}</p>
          </>
        ) : variant === "ticker" ? (
          <>
            <p className="truncate" style={{ fontSize: 11, fontWeight: 500, color: INDIGO }}>{quote.symbol}</p>
            <p className="truncate" style={{ fontSize: 10, color: DIM }}>{quote.name}</p>
          </>
        ) : (
          <p className="truncate" style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{quote.name}</p>
        )}
      </div>
      <MiniSparkline quote={quote} width={spark.width} height={spark.height} />
      <div className="shrink-0 text-right" style={{ minWidth: 62, fontVariantNumeric: "tabular-nums" }}>
        <p style={{ fontSize: variant === "index" ? 13 : 12, fontWeight: 500, color: TEXT }}>{formatPrice(quote)}</p>
        <p style={{ fontSize: 11, color: changeColor(quote.changePercent) }}>{formatPercent(quote.changePercent)}</p>
      </div>
      {onRemove && (
        <button type="button" onClick={onRemove} aria-label={`Retirer ${quote.symbol}`} className="mk-hover shrink-0" style={{ fontSize: 11 }}>
          ✕
        </button>
      )}
    </li>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <div aria-hidden className="animate-pulse">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center justify-between" style={{ padding: "10px 0" }}>
          <span style={{ background: black(0.06), height: 11, width: "42%", borderRadius: 3 }} />
          <span style={{ background: black(0.06), height: 11, width: "22%", borderRadius: 3 }} />
        </div>
      ))}
    </div>
  );
}

function QuoteList({
  quotes,
  variant,
  skeleton,
  spark = { width: 48, height: 18 },
  padding,
}: {
  /** null while loading. */
  quotes: Quote[] | null;
  variant: "index" | "ticker" | "plain";
  skeleton: number;
  spark?: { width: number; height: number };
  padding?: string;
}) {
  if (!quotes) return <SkeletonRows count={skeleton} />;
  if (quotes.length === 0) return <p style={{ fontSize: 11, color: DIM, padding: "8px 0" }}>Données indisponibles.</p>;
  return (
    <ul>
      {quotes.map((quote, index) => (
        <QuoteRow key={quote.symbol} quote={quote} variant={variant} last={index === quotes.length - 1} spark={spark} padding={padding} />
      ))}
    </ul>
  );
}

function PillRow<T extends string>({ options, value, onChange, label }: { options: readonly { value: T; label: string }[]; value: T; onChange: (value: T) => void; label: string }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap" style={{ gap: 4 }}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          aria-pressed={value === option.value}
          className={value === option.value ? "" : "mk-pill"}
          style={{ fontSize: 10, padding: "3px 9px", borderRadius: 20, ...(value === option.value ? { background: INDIGO, color: BG } : {}) }}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function axisLabel(timestamp: number, period: ChartPeriod) {
  const date = new Date(timestamp);
  if (period === "1J") return date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
  if (period === "1S") return date.toLocaleDateString("fr-FR", { weekday: "short" });
  if (period === "1A") return date.toLocaleDateString("fr-FR", { month: "short", year: "2-digit" });
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

function tooltipLabel(timestamp: number, period: ChartPeriod) {
  const date = new Date(timestamp);
  const day = date.toLocaleDateString("fr-FR", { weekday: "short", day: "numeric", month: "short", ...(period === "1A" ? { year: "numeric" } : {}) });
  const intraday = period === "1J" || period === "1S";
  return intraday ? `${day} · ${date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : day;
}

/** Real price history from Yahoo Finance for the selected asset and period. */
function MainChart({ refreshKey }: { refreshKey: number | null }) {
  const gradientId = useId();
  const [symbol, setSymbol] = useState(chartAssets[0].symbol);
  const [period, setPeriod] = useState<ChartPeriod>("1J");
  const [data, setData] = useState<ChartData | null>(null);
  const [error, setError] = useState(false);
  const asset = chartAssets.find((item) => item.symbol === symbol) ?? chartAssets[0];

  // Reset on a new selection so the previous asset's curve is never shown under the new name.
  useEffect(() => {
    setData(null);
    setError(false);
  }, [symbol, period]);

  // Also re-runs on every quotes refresh, so the intraday chart follows the market.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/markets/chart?symbol=${encodeURIComponent(symbol)}&period=${period}`)
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error();
        if (!cancelled) {
          setData(body);
          setError(false);
        }
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, period, refreshKey]);

  const format = (value: number) =>
    value.toLocaleString("fr-FR", { minimumFractionDigits: asset.decimals, maximumFractionDigits: asset.decimals });
  const last = data ? data.points[data.points.length - 1].price : 0;
  const rising = data ? last >= data.reference : true;
  const color = rising ? UP : DOWN;
  const change = data && data.reference ? ((last - data.reference) / data.reference) * 100 : 0;

  return (
    <div>
      <PillRow label="Actif" options={chartAssets.map((item) => ({ value: item.symbol, label: item.label }))} value={symbol} onChange={setSymbol} />

      <div className="mt-3 flex items-baseline gap-2" style={{ minHeight: 24, fontVariantNumeric: "tabular-nums" }}>
        {data && (
          <>
            <span style={{ fontFamily: GEORGIA, fontSize: 20, color: TEXT }}>{format(last)}</span>
            <span style={{ fontSize: 12, color: changeColor(change) }}>{formatPercent(change)}</span>
            <span style={{ fontSize: 10, color: DIM }}>sur la période</span>
          </>
        )}
      </div>

      <div className="mt-1" style={{ height: 200 }}>
        {error && !data ? (
          <p className="flex h-full items-center justify-center text-center" style={{ fontSize: 11, color: DIM }}>
            Historique indisponible pour cet actif.
          </p>
        ) : !data ? (
          <div aria-hidden className="h-full animate-pulse" style={{ background: black(0.04), borderRadius: 8 }} />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data.points} margin={{ top: 6, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="t"
                tickFormatter={(value: number) => axisLabel(value, period)}
                tick={{ fontSize: 10, fill: DIM }}
                tickLine={false}
                axisLine={{ stroke: black(0.08) }}
                minTickGap={36}
              />
              <YAxis
                domain={["auto", "auto"]}
                tickFormatter={format}
                tick={{ fontSize: 10, fill: DIM }}
                tickLine={false}
                axisLine={false}
                width={asset.decimals === 4 ? 50 : 44}
              />
              <Tooltip
                cursor={{ stroke: black(0.15) }}
                content={({ active, payload }) => {
                  const point = active ? (payload?.[0]?.payload as { t: number; price: number } | undefined) : undefined;
                  if (!point) return null;
                  return (
                    <div style={{ background: SURFACE, border: `1px solid ${black(0.1)}`, borderRadius: 8, padding: "8px 12px" }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: TEXT }}>{format(point.price)}</p>
                      <p style={{ fontSize: 10, color: DIM }}>{tooltipLabel(point.t, period)}</p>
                    </div>
                  );
                }}
              />
              <ReferenceLine y={data.reference} stroke={text(0.3)} strokeDasharray="3 3" />
              <Area type="monotone" dataKey="price" stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} isAnimationActive={false} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mt-3">
        <PillRow label="Période" options={chartPeriods.map((item) => ({ value: item, label: item }))} value={period} onChange={setPeriod} />
      </div>
    </div>
  );
}

function newsTag(article: NewsArticle) {
  if (/\b(urgent|alerte|en direct)\b/i.test(article.title)) {
    return { label: "URGENT", background: "rgba(220,38,38,0.1)", color: DOWN };
  }
  if (/\b(flash|exclusif|info)\b/i.test(article.title)) {
    return { label: "FLASH", background: "rgba(196,169,74,0.1)", color: "#8B6914" };
  }
  return null;
}

// Portfolio and alerts are now loaded dynamically from user-markets.ts

const money = (value: number, currency: string) =>
  `${value.toLocaleString("fr-FR", { maximumFractionDigits: 0 })} ${currency === "EUR" ? "€" : "$"}`;

/** Values each position in dollars from the quotes on screen; null until they are all available. */
function valuePortfolio(markets: MarketsResponse, portfolio: { id: string; symbol: string; quantity: number; label: string }[]) {
  if (portfolio.length === 0) return null;
  const quotes = [...markets.stocksUs, ...markets.stocksFr, ...markets.commodities, ...markets.fx];
  const eurusd = markets.fx.find((quote) => quote.symbol === "EURUSD=X")?.price;
  if (!eurusd) return null;

  const positions = portfolio.map((position) => {
    const quote = quotes.find((item) => item.symbol === position.symbol);
    if (!quote) return null;
    // The EUR/USD line is a €10k holding: its dollar value is the amount times the rate.
    const isFx = quote.kind === "fx";
    const currency = isFx ? "USD" : (quote.currency ?? "USD");
    const value = position.quantity * quote.price;
    return { ...position, value, currency, usd: currency === "EUR" ? value * eurusd : value, changePercent: quote.changePercent };
  });
  if (positions.some((position) => position === null)) return null;

  const held = positions.filter((position) => position !== null);
  const total = held.reduce((sum, position) => sum + position.usd, 0);
  const changePercent = held.reduce((sum, position) => sum + position.usd * position.changePercent, 0) / total;
  return { positions: held, total, changePercent };
}

function vixLevel(value: number) {
  if (value < 20) return "Faible";
  if (value < 30) return "Modérée";
  return "Élevée";
}

function Gauge({ label, value, display, color, note }: { label: string; value: number; display: string; color: string; note: string }) {
  return (
    <div className="mb-2">
      <div className="mb-1 flex items-baseline justify-between gap-2">
        <span style={{ fontSize: 10, fontWeight: 500, color: TEXT }}>
          {label} <span style={{ fontWeight: 400, color: DIM }}>· {note}</span>
        </span>
        <span style={{ fontSize: 10, fontWeight: 500, color, fontVariantNumeric: "tabular-nums" }}>{display}</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        style={{ background: BORDER, height: 3, borderRadius: 2 }}
      >
        <div style={{ width: `${Math.min(100, Math.max(0, value))}%`, height: 3, borderRadius: 2, background: color }} />
      </div>
    </div>
  );
}

function formatVolume(volume: number) {
  const [value, unit] = volume >= 1e9 ? [volume / 1e9, "Md"] : [volume / 1e6, "M"];
  return `${value.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} ${unit}`;
}

/** "Hier" for yesterday's session, otherwise the short weekday ("Lun."). */
function sessionLabel(isoDate: string) {
  const date = new Date(`${isoDate}T12:00:00`);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Hier";
  const weekday = date.toLocaleDateString("fr-FR", { weekday: "short" });
  return weekday.charAt(0).toUpperCase() + weekday.slice(1);
}

const pct = (value: number) =>
  `${Math.abs(value).toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;

/** Days until the next US jobs report, published on the first Friday of the month. */
function daysToJobsReport(now: Date) {
  const firstFriday = (year: number, month: number) => {
    const date = new Date(year, month, 1);
    date.setDate(1 + ((5 - date.getDay() + 7) % 7));
    return date;
  };
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let next = firstFriday(today.getFullYear(), today.getMonth());
  if (next < today) next = firstFriday(today.getFullYear(), today.getMonth() + 1);
  return Math.round((next.getTime() - today.getTime()) / 86_400_000);
}

/** Rule-based comments on the figures currently on screen. */
function buildInsights(markets: MarketsResponse, now: Date) {
  const insights: { icon: string; text: string }[] = [];

  const cac = markets.indices.find((quote) => quote.symbol === "^FCHI");
  if (cac && markets.stocksFr.length > 0) {
    const sorted = [...markets.stocksFr].sort((a, b) => b.changePercent - a.changePercent);
    const rising = cac.changePercent >= 0;
    const mover = rising ? sorted[0] : sorted[sorted.length - 1];
    insights.push({
      icon: rising ? "📈" : "📉",
      text: rising
        ? `Le CAC 40 progresse de ${pct(cac.changePercent)} — porté par ${mover.name} (${formatPercent(mover.changePercent)}).`
        : `Le CAC 40 recule de ${pct(cac.changePercent)} — pénalisé par ${mover.name} (${formatPercent(mover.changePercent)}).`,
    });
  }

  const eurusd = markets.fx.find((quote) => quote.symbol === "EURUSD=X");
  if (eurusd) {
    insights.push({
      icon: "⚡",
      text:
        eurusd.changePercent <= -0.5
          ? `Le dollar s'apprécie face à l'euro (EUR/USD ${formatPercent(eurusd.changePercent)}).`
          : eurusd.changePercent >= 0.5
            ? `L'euro s'apprécie face au dollar (EUR/USD ${formatPercent(eurusd.changePercent)}).`
            : `EUR/USD quasi stable (${formatPercent(eurusd.changePercent)}) : pas de mouvement marqué sur les changes.`,
    });
  }

  const gold = markets.commodities.find((quote) => quote.symbol === "GC=F");
  if (gold) {
    insights.push({
      icon: gold.changePercent > 0 ? "📈" : "📉",
      text:
        gold.changePercent > 0
          ? `L'or confirme son statut de valeur refuge (${formatPercent(gold.changePercent)}).`
          : `L'or cède ${pct(gold.changePercent)} sur la séance.`,
    });
  }

  const days = daysToJobsReport(now);
  insights.push({
    icon: "🔍",
    text: `Prochain événement macro : rapport sur l'emploi américain ${days === 0 ? "aujourd'hui" : `dans ${days}j`}.`,
  });

  return insights;
}

export default function MarketsDashboard({ session }: { session: Session }) {
  const [markets, setMarkets] = useState<MarketsResponse | null>(null);
  const [quotesError, setQuotesError] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  // Set after mount and ticking every second; null on the server.
  const [now, setNow] = useState<Date | null>(null);
  const [stockTab, setStockTab] = useState<"FR" | "US">("FR");

  // null while loading.
  const [news, setNews] = useState<NewsArticle[] | null>(null);
  const [newsError, setNewsError] = useState(false);
  const [newsLoadedAt, setNewsLoadedAt] = useState<Date | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [sharing, setSharing] = useState<NewsArticle | null>(null);

  // null until read from localStorage, so the defaults never overwrite a saved list.
  const [watchlist, setWatchlist] = useState<string[] | null>(null);
  const [watchQuotes, setWatchQuotes] = useState<Quote[] | null>(null);
  const [tickerInput, setTickerInput] = useState("");
  const [tickerError, setTickerError] = useState<string | null>(null);

  // Daily sessions and volumes of the main indices; null while loading.
  const [history, setHistory] = useState<MarketHistory | null>(null);
  const [historyError, setHistoryError] = useState(false);

  // User portfolio & alerts (loaded from Supabase or localStorage)
  const [userPortfolio, setUserPortfolio] = useState<PortfolioPosition[]>([]);
  const [userAlerts, setUserAlerts] = useState<PriceAlert[]>([]);
  const [portfolioInput, setPortfolioInput] = useState("");
  const [alertInput, setAlertInput] = useState("");

  const loadQuotes = useCallback(async () => {
    try {
      const res = await fetch("/api/markets/quotes");
      if (!res.ok) throw new Error();
      setMarkets(await res.json());
      setQuotesError(false);
      setUpdatedAt(Date.now());
    } catch {
      setQuotesError(true);
    }
  }, []);

  const loadWatchlist = useCallback(async (symbols: string[]) => {
    if (symbols.length === 0) {
      setWatchQuotes([]);
      return;
    }
    try {
      const res = await fetch(`/api/markets/quotes?symbols=${encodeURIComponent(symbols.join(","))}`);
      if (!res.ok) throw new Error();
      setWatchQuotes((await res.json()).quotes);
    } catch {
      // Keep the previous values; the header already reports failed refreshes.
    }
  }, []);

  const loadNews = useCallback(async () => {
    setNews(null);
    setNewsError(false);
    try {
      const res = await fetch("/api/markets/news");
      const data = await res.json();
      if (!res.ok || data.status !== "ok") throw new Error();
      setNews(data.articles);
      setNewsLoadedAt(new Date());
    } catch {
      setNewsError(true);
    }
  }, []);

  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    let saved: unknown = null;
    try {
      saved = JSON.parse(localStorage.getItem(WATCHLIST_KEY) ?? "null");
    } catch {
      // Unreadable or blocked storage: fall back to the defaults.
    }
    setWatchlist(
      Array.isArray(saved) ? saved.filter((item): item is string => typeof item === "string" && SYMBOL_PATTERN.test(item)) : DEFAULT_WATCHLIST,
    );
    loadNews();
    loadQuotes();
    // Load user portfolio & alerts
    const userId = session.user.id;
    loadPortfolio(userId).then(setUserPortfolio);
    loadAlerts(userId).then(setUserAlerts);
    fetch("/api/markets/history")
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setHistory(await res.json());
      })
      .catch(() => setHistoryError(true));
    const timer = setInterval(loadQuotes, REFRESH_MS);
    return () => clearInterval(timer);
  }, [loadNews, loadQuotes]);

  useEffect(() => {
    if (!watchlist) return;
    try {
      localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));
    } catch {
      // Storage unavailable: the list just won't persist.
    }
    loadWatchlist(watchlist);
    const timer = setInterval(() => loadWatchlist(watchlist), REFRESH_MS);
    return () => clearInterval(timer);
  }, [watchlist, loadWatchlist]);

  const closeReader = useCallback(() => setSelectedArticle(null), []);

  const addTicker = (event: FormEvent) => {
    event.preventDefault();
    const symbol = tickerInput.trim().toUpperCase();
    if (!symbol || !watchlist) return;
    if (!SYMBOL_PATTERN.test(symbol)) {
      setTickerError("Ticker invalide.");
      return;
    }
    if (watchlist.includes(symbol)) {
      setTickerError("Déjà dans ta watchlist.");
      return;
    }
    setTickerError(null);
    setTickerInput("");
    setWatchlist([...watchlist, symbol]);
  };

  const handleAddPortfolio = async (event: FormEvent) => {
    event.preventDefault();
    const parts = portfolioInput.trim().split(/\s+/);
    const symbol = parts[0]?.toUpperCase();
    const qty = parseFloat(parts[1] ?? "1");
    if (!symbol || !SYMBOL_PATTERN.test(symbol) || isNaN(qty) || qty <= 0) return;
    const label = qty === 1 ? "1 unité" : `${qty} unités`;
    const pos = await addPortfolioPosition(session.user.id, symbol, qty, label);
    if (pos) setUserPortfolio((prev) => [...prev, pos]);
    setPortfolioInput("");
  };

  const handleRemovePortfolio = async (id: string) => {
    await removePortfolioPosition(session.user.id, id);
    setUserPortfolio((prev) => prev.filter((p) => p.id !== id));
  };

  const handleAddAlert = async (event: FormEvent) => {
    event.preventDefault();
    // Format: "AAPL > 350" or "CAC < 7500"
    const match = alertInput.trim().match(/^(\S+)\s*([><])\s*(\d+[\d.,]*)/);
    if (!match) return;
    const [, symbol, op, val] = match;
    const target = parseFloat(val.replace(",", "."));
    if (!symbol || isNaN(target)) return;
    const condition = op === ">" ? "above" as const : "below" as const;
    const alert = await addAlert(session.user.id, symbol, condition, target);
    if (alert) setUserAlerts((prev) => [...prev, alert]);
    setAlertInput("");
  };

  const handleRemoveAlert = async (id: string) => {
    await removeAlert(session.user.id, id);
    setUserAlerts((prev) => prev.filter((a) => a.id !== id));
  };

  const tickerItems = markets ? [...markets.indices, ...markets.fx, ...markets.commodities] : [];
  const heroIndices = markets
    ? HERO_SYMBOLS.map((symbol) => markets.indices.find((quote) => quote.symbol === symbol)).filter((quote): quote is Quote => Boolean(quote))
    : null;
  const stocks = markets ? (stockTab === "FR" ? markets.stocksFr : markets.stocksUs).slice(0, STOCKS_SHOWN) : null;
  // Best and worst of the twenty stocks fetched.
  const movers = markets
    ? (() => {
        const sorted = [...markets.stocksFr, ...markets.stocksUs].sort((a, b) => b.changePercent - a.changePercent);
        return {
          gainers: sorted.filter((quote) => quote.changePercent > 0).slice(0, 3),
          losers: sorted.filter((quote) => quote.changePercent < 0).slice(-3).reverse(),
        };
      })()
    : null;
  const topNews = (news ?? []).slice(0, 4);
  const insights = markets && now ? buildInsights(markets, now) : null;
  const secondsAgo = updatedAt && now ? Math.max(0, Math.round((now.getTime() - updatedAt) / 1000)) : null;
  // Symbols saved in the watchlist that the quotes route returned nothing for.
  const unknownSymbols =
    watchlist && watchQuotes ? watchlist.filter((symbol) => !watchQuotes.some((quote) => quote.symbol === symbol)) : [];
  const live = !quotesError && markets !== null;
  const vix = markets?.volatility?.[0] ?? null;
  const quotesFailed = quotesError && !markets;
  const holdings = markets && userPortfolio.length > 0 ? valuePortfolio(markets, userPortfolio) : null;
  const maxSectorMove = Math.max(0.01, ...(markets?.sectors ?? []).map((sector) => Math.abs(sector.changePercent)));

  return (
    <div className="pb-8" style={{ background: PAGE_GRADIENT, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <style>{css}</style>

      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 md:px-8" style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}` }}>
        <div className="flex items-center">
          <h2 style={{ fontFamily: GEORGIA, fontSize: 24, fontWeight: 400, color: TEXT }}>Bourse</h2>
          <span
            className="ml-3"
            style={{
              fontSize: 9,
              letterSpacing: "0.1em",
              borderRadius: 4,
              padding: "2px 7px",
              ...(live
                ? { background: "rgba(22,163,74,0.1)", color: UP, border: "1px solid rgba(22,163,74,0.3)" }
                : { background: "rgba(196,169,74,0.12)", color: "#8B6914", border: "1px solid rgba(196,169,74,0.3)" }),
            }}
          >
            {live ? "LIVE" : quotesError ? "HORS LIGNE" : "CONNEXION"}
          </span>
          {live && <PulseDot className="ml-2" />}
        </div>
        <div className="flex items-center">
          <span style={{ fontFamily: MONO, fontSize: 13, color: ACCENT, fontVariantNumeric: "tabular-nums" }}>
            {now ? now.toLocaleTimeString("fr-FR") : "--:--:--"}
          </span>
          <span className="ml-3" role="status" style={{ fontSize: 11, color: quotesError ? "#8B6914" : DIM }}>
            {quotesError
              ? "Dernière actualisation échouée"
              : secondsAgo === null
                ? "Chargement…"
                : `Mis à jour il y a ${secondsAgo}s`}
          </span>
        </div>
      </header>

      <div aria-hidden className="overflow-hidden" style={{ background: TICKER_BG, padding: "8px 0", minHeight: 33 }}>
        {tickerItems.length > 0 && (
          <div className="mk-ticker" style={{ fontFamily: MONO, fontSize: 11 }}>
            {/* Rendered twice so the loop restarts seamlessly at -50%. */}
            {[0, 1].map((copy) =>
              tickerItems.map((quote) => {
                const rounded = Math.round(quote.changePercent * 100) / 100;
                return (
                  <span key={`${copy}-${quote.symbol}`} className="flex shrink-0 items-center" style={{ gap: 8, whiteSpace: "nowrap" }}>
                    <span style={{ color: "rgba(255,255,255,0.5)" }}>{quote.name}</span>
                    <span style={{ color: "#FFFFFF", fontWeight: 500 }}>{formatPrice(quote)}</span>
                    {/* Brighter greens and reds than the cards: these sit on the dark band. */}
                    <span style={{ color: rounded > 0 ? "#4ADE80" : rounded < 0 ? "#F87171" : "rgba(255,255,255,0.5)" }}>
                      {formatPercent(quote.changePercent)}
                    </span>
                    <span style={{ color: "rgba(255,255,255,0.2)", padding: "0 12px" }}>|</span>
                  </span>
                );
              }),
            )}
          </div>
        )}
      </div>

      {/* Zone 1 — the five main indices */}
      <section className="px-5 py-6 md:px-8" style={{ background: SURFACE, borderBottom: `1px solid ${BORDER}` }}>
        {quotesFailed ? (
          <div role="alert" className="text-center" style={{ padding: "32px 20px" }}>
            <p style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>Impossible de charger les cotations</p>
            <p className="mt-1" style={{ fontSize: 12, color: DIM }}>La source de données ne répond pas pour le moment.</p>
            <button
              type="button"
              onClick={loadQuotes}
              className="mk-hover mt-4"
              style={{ border: `1px solid ${black(0.12)}`, borderRadius: 8, fontSize: 12, padding: "6px 16px" }}
            >
              Réessayer
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 items-stretch sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5" style={{ gap: 1, background: black(0.06), border: `1px solid ${black(0.06)}` }}>
            {heroIndices
              ? heroIndices.map((quote) => <HeroIndex key={quote.symbol} quote={quote} />)
              : HERO_SYMBOLS.map((symbol) => (
                  <div key={symbol} aria-hidden style={{ background: SURFACE, padding: "14px 20px", height: HERO_HEIGHT }}>
                    <div className="animate-pulse">
                      <div style={{ background: black(0.06), height: 10, width: "40%", borderRadius: 3 }} />
                      <div className="mt-3" style={{ background: black(0.06), height: 22, width: "60%", borderRadius: 3 }} />
                      <div className="mt-3" style={{ background: black(0.04), height: 52, borderRadius: 6 }} />
                    </div>
                  </div>
                ))}
          </div>
        )}
      </section>

      {/* Zone 2 — detailed data */}
      <div className="mk-cols">
        <div className="mk-col mk-col-1">
        <section style={{ ...panel, padding: 16 }}>
          <Label className="mb-4">Indices</Label>
          <QuoteList quotes={markets?.indices ?? null} variant="index" skeleton={6} spark={{ width: 40, height: 22 }} padding="10px 0" />

          <Divider className="my-4" />

          <Label className="mb-3">Performances du jour</Label>
          {!movers ? (
            <SkeletonRows count={6} />
          ) : movers.gainers.length + movers.losers.length === 0 ? (
            <p style={{ fontSize: 11, color: DIM }}>Aucun mouvement pour l&apos;instant.</p>
          ) : (
            <ul>
              {[...movers.gainers, ...movers.losers].map((quote) => {
                const rising = quote.changePercent > 0;
                return (
                  <li
                    key={quote.symbol}
                    className="mb-2 flex items-center gap-2"
                    style={{
                      background: rising ? "rgba(22,163,74,0.06)" : "rgba(220,38,38,0.06)",
                      border: `1px solid ${rising ? "rgba(22,163,74,0.15)" : "rgba(220,38,38,0.12)"}`,
                      borderRadius: 8,
                      padding: "8px 12px",
                    }}
                  >
                    <span className="shrink-0" style={{ fontSize: 11, fontWeight: 500, color: TEXT }}>{quote.symbol}</span>
                    <span className="min-w-0 truncate" style={{ fontSize: 10, color: DIM }}>{quote.name}</span>
                    <span className="ml-auto shrink-0" style={{ fontSize: 11, fontWeight: 500, color: rising ? UP : DOWN, fontVariantNumeric: "tabular-nums" }}>
                      {formatPercent(quote.changePercent)}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}

          <Divider />

          <Label className="mb-3">Volumes</Label>
          {historyError ? (
            <p style={{ fontSize: 11, color: DIM }}>Indisponible.</p>
          ) : !history ? (
            <SkeletonRows count={3} />
          ) : (
            <ul>
              {history.volumes.map((item, index) => (
                <li key={item.name} style={{ padding: "7px 0", borderBottom: index < history.volumes.length - 1 ? `1px solid ${black(0.05)}` : "none" }}>
                  <div className="flex items-baseline justify-between gap-2">
                    <span style={{ fontSize: 11, fontWeight: 500, color: TEXT }}>{item.name}</span>
                    <span style={{ fontSize: 11, color: DIM, fontVariantNumeric: "tabular-nums" }}>{formatVolume(item.volume)}</span>
                  </div>
                  <div className="mt-1.5" style={{ height: 3, background: "rgba(42,53,96,0.15)", borderRadius: 2 }}>
                    <div style={{ height: 3, width: `${item.percentOfMax}%`, background: INDIGO, borderRadius: 2 }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
          {history && (
            <p className="mt-2" style={{ fontSize: 9, color: text(0.3), fontStyle: "italic" }}>
              Titres échangés, dernière séance close ; barre : part du plus haut du mois.
            </p>
          )}

          <Divider />

          <Label className="mb-3">Dernières séances</Label>
          {historyError ? (
            <p style={{ fontSize: 11, color: DIM }}>Indisponible.</p>
          ) : !history ? (
            <SkeletonRows count={5} />
          ) : (
            <table className="w-full" style={{ fontVariantNumeric: "tabular-nums" }}>
              <thead>
                <tr style={{ fontSize: 9, color: text(0.3) }}>
                  <th className="pb-1 text-left" style={{ fontWeight: 400 }}>Séance</th>
                  <th className="pb-1 text-right" style={{ fontWeight: 400 }}>CAC 40</th>
                  <th className="pb-1 text-right" style={{ fontWeight: 400 }}>S&amp;P 500</th>
                </tr>
              </thead>
              <tbody>
                {history.sessions.map((session) => (
                  <tr key={session.date} style={{ borderTop: `1px solid ${black(0.05)}` }}>
                    <td style={{ fontSize: 10, color: DIM, padding: "6px 0" }}>{sessionLabel(session.date)}</td>
                    <td className="text-right" style={{ fontSize: 11, color: changeColor(session.cac) }}>{formatPercent(session.cac)}</td>
                    <td className="text-right" style={{ fontSize: 11, color: session.sp === null ? DIM : changeColor(session.sp) }}>
                      {session.sp === null ? "—" : formatPercent(session.sp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <Divider />

          <Label className="mb-3">Alertes prix</Label>
          {userAlerts.length === 0 ? (
            <p style={{ fontSize: 11, color: DIM, padding: "4px 0" }}>Aucune alerte configurée.</p>
          ) : (
            <ul>
              {userAlerts.map((alert) => (
                <li key={alert.id} className="mb-2 flex items-center justify-between gap-2" style={{ background: BG, borderRadius: 8, padding: 9 }}>
                  <span className="min-w-0 truncate" style={{ fontSize: 11, color: TEXT }}>
                    <span aria-hidden>🔔</span> {alert.label}
                  </span>
                  <button type="button" onClick={() => handleRemoveAlert(alert.id)} aria-label="Supprimer" className="mk-hover shrink-0" style={{ fontSize: 11, color: DIM }}>✕</button>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={handleAddAlert} className="mt-2">
            <input
              value={alertInput}
              onChange={(e) => setAlertInput(e.target.value)}
              placeholder="AAPL > 350"
              aria-label="Ajouter une alerte"
              className="mk-input w-full"
              style={{ background: BG, border: `1px solid ${black(0.08)}`, borderRadius: 6, padding: "6px 10px", fontFamily: MONO, fontSize: 11, color: TEXT, outline: "none" }}
            />
          </form>
        </section>
        </div>

        <div className="mk-col mk-col-2">
        <section style={panel}>
          <MainChart refreshKey={updatedAt} />

          <Divider className="my-4" />

          <div className="mb-3 flex items-center justify-between">
            <Label>Actions</Label>
            <PillRow
              label="Marché"
              options={[
                { value: "FR", label: "FR" },
                { value: "US", label: "US" },
              ] as const}
              value={stockTab}
              onChange={setStockTab}
            />
          </div>
          <QuoteList quotes={stocks} variant="ticker" skeleton={STOCKS_SHOWN} padding="7px 0" />

        </section>

        <section style={panel}>
          <Label className="mb-3">Top news</Label>
          {newsError ? (
            <p style={{ fontSize: 11, color: DIM }}>Actualités indisponibles.</p>
          ) : news === null ? (
            <div aria-hidden className="animate-pulse">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} style={{ padding: "8px 0" }}>
                  <div style={{ background: black(0.05), borderRadius: 4, height: 12, width: "35%" }} />
                  <div className="mt-2" style={{ background: black(0.05), borderRadius: 4, height: 12 }} />
                </div>
              ))}
            </div>
          ) : topNews.length === 0 ? (
            <p style={{ fontSize: 11, color: DIM }}>Aucune dépêche pour l&apos;instant.</p>
          ) : (
            <ul>
              {topNews.map((article, index) => (
                <li key={article.url} style={{ padding: "8px 0", borderBottom: index < topNews.length - 1 ? `1px solid ${black(0.04)}` : "none" }}>
                  <span className="inline-block max-w-full truncate" style={{ fontSize: 9, background: "rgba(42,53,96,0.07)", color: INDIGO, padding: "2px 7px", borderRadius: 4 }}>
                    {article.source.name}
                  </span>
                  <p className="mt-1 line-clamp-2" style={{ fontSize: 11, fontWeight: 500, color: TEXT, lineHeight: 1.35 }}>{article.title}</p>
                  <button type="button" onClick={() => setSelectedArticle(article)} className="mt-1 hover:underline" style={{ fontSize: 10, color: INDIGO }}>
                    Lire →
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section style={panel}>
          <Label className="mb-3">Movers du jour</Label>
          {!movers ? (
            <SkeletonRows count={4} />
          ) : (
            <>
              {movers.gainers.length > 0 && (
                <>
                  <p className="mb-1" style={{ fontSize: 9, color: UP, textTransform: "uppercase", letterSpacing: "0.08em" }}>Hausse</p>
                  <ul>
                    {movers.gainers.map((q) => (
                      <li key={q.symbol} className="flex items-baseline justify-between gap-2" style={{ padding: "6px 0" }}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: TEXT }}>{q.name ?? q.symbol}</span>
                        <span style={{ fontSize: 11, color: UP, fontVariantNumeric: "tabular-nums" }}>{formatPercent(q.changePercent)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {movers.losers.length > 0 && (
                <>
                  <p className="mb-1 mt-2" style={{ fontSize: 9, color: DOWN, textTransform: "uppercase", letterSpacing: "0.08em" }}>Baisse</p>
                  <ul>
                    {movers.losers.map((q) => (
                      <li key={q.symbol} className="flex items-baseline justify-between gap-2" style={{ padding: "6px 0" }}>
                        <span style={{ fontSize: 11, fontWeight: 500, color: TEXT }}>{q.name ?? q.symbol}</span>
                        <span style={{ fontSize: 11, color: DOWN, fontVariantNumeric: "tabular-nums" }}>{formatPercent(q.changePercent)}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </>
          )}
        </section>
        </div>

        <div className="mk-col mk-col-3">
        <section style={panel}>
          <Label className="mb-1">Forex</Label>
          <QuoteList quotes={markets?.fx ?? null} variant="plain" skeleton={4} />
          <Divider />
          <Label className="mb-1">Taux souverains</Label>
          <QuoteList quotes={markets?.rates ?? null} variant="plain" skeleton={3} />
          <Divider />
          <Label className="mb-1">Matières premières</Label>
          <QuoteList quotes={markets?.commodities ?? null} variant="plain" skeleton={4} />

          <Divider />

          <Label className="mb-2">Sentiment</Label>
          {vix ? (
            <Gauge
              label="VIX (Volatilité)"
              value={vix.price}
              display={vix.price.toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
              color={GOLD}
              note={vixLevel(vix.price)}
            />
          ) : (
            <Gauge label="VIX (Volatilité)" value={0} display="n.d." color={GOLD} note={markets ? "Indisponible" : "Chargement…"} />
          )}

          <Divider />

          <Label className="mb-1">Crypto</Label>
          <QuoteList quotes={markets?.crypto ?? null} variant="ticker" skeleton={4} padding="8px 0" />

          <Divider />

          <Label className="mb-3">Indices sectoriels · États-Unis</Label>
          {!markets ? (
            <SkeletonRows count={6} />
          ) : markets.sectors.length === 0 ? (
            <p style={{ fontSize: 11, color: DIM }}>Données indisponibles.</p>
          ) : (
            <ul>
              {markets.sectors.map((sector, index) => (
                <li
                  key={sector.symbol}
                  className="flex items-center gap-3"
                  style={{ padding: "7px 0", borderBottom: index < markets.sectors.length - 1 ? `1px solid ${black(0.05)}` : "none" }}
                >
                  <span className="shrink-0" style={{ width: 92, fontSize: 11, fontWeight: 500, color: TEXT }}>
                    <span aria-hidden>{sector.detail}</span> {sector.name}
                  </span>
                  <span className="min-w-0 flex-1" style={{ height: 3, background: black(0.06), borderRadius: 2 }}>
                    <span
                      className="block"
                      style={{
                        height: 3,
                        borderRadius: 2,
                        // Bar length: the move relative to the day's biggest sector move.
                        width: `${Math.max(4, (Math.abs(sector.changePercent) / maxSectorMove) * 100)}%`,
                        background: changeColor(sector.changePercent),
                      }}
                    />
                  </span>
                  <span className="shrink-0 text-right" style={{ width: 56, fontSize: 11, color: changeColor(sector.changePercent), fontVariantNumeric: "tabular-nums" }}>
                    {formatPercent(sector.changePercent)}
                  </span>
                </li>
              ))}
            </ul>
          )}

          <Divider />

          <Label className="mb-3">Taux de change exotiques</Label>
          {!markets ? (
            <SkeletonRows count={4} />
          ) : markets.fxExotic.length === 0 ? (
            <p style={{ fontSize: 11, color: DIM }}>Données indisponibles.</p>
          ) : (
            <ul style={{ fontVariantNumeric: "tabular-nums" }}>
              {markets.fxExotic.map((pair, index) => (
                <li
                  key={pair.symbol}
                  className="flex items-baseline justify-between gap-3"
                  style={{ padding: "7px 0", borderBottom: index < markets.fxExotic.length - 1 ? `1px solid ${black(0.05)}` : "none" }}
                >
                  <span style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{pair.name}</span>
                  <span className="ml-auto" style={{ fontSize: 12, color: TEXT }}>
                    {pair.price.toLocaleString("fr-FR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
                  </span>
                  <span className="text-right" style={{ width: 56, fontSize: 11, color: changeColor(pair.changePercent) }}>
                    {formatPercent(pair.changePercent)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
        </div>

        <div className="mk-col mk-col-4">
        <aside className="flex flex-col" style={panel}>
          <Label className="mb-3">Ma watchlist</Label>
          <form onSubmit={addTicker}>
            <input
              value={tickerInput}
              onChange={(event) => {
                setTickerInput(event.target.value);
                setTickerError(null);
              }}
              placeholder="Ajouter un ticker..."
              aria-label="Ajouter un ticker"
              autoCapitalize="characters"
              spellCheck={false}
              className="mk-input w-full"
              style={{ background: BG, border: `1px solid ${black(0.08)}`, borderRadius: 6, padding: "6px 10px", fontFamily: MONO, fontSize: 11, color: TEXT, outline: "none" }}
            />
          </form>
          {tickerError && (
            <p role="alert" className="mt-1.5" style={{ fontSize: 11, color: DOWN }}>{tickerError}</p>
          )}
          <div className="mt-1">
            {!watchlist || !watchQuotes ? (
              <SkeletonRows count={7} />
            ) : watchlist.length === 0 ? (
              <p style={{ fontSize: 11, color: DIM, padding: "8px 0" }}>Ta watchlist est vide.</p>
            ) : (
              <ul>
                {watchQuotes.map((quote, index) => (
                  <QuoteRow
                    key={quote.symbol}
                    quote={quote}
                    variant="ticker"
                    last={index === watchQuotes.length - 1 && unknownSymbols.length === 0}
                    spark={{ width: 36, height: 16 }}
                    padding="7px 0"
                    onRemove={() => setWatchlist(watchlist.filter((symbol) => symbol !== quote.symbol))}
                  />
                ))}
                {unknownSymbols.map((symbol, index) => (
                  <li
                    key={symbol}
                    className="flex items-center justify-between gap-2"
                    style={{ padding: "7px 0", borderBottom: index === unknownSymbols.length - 1 ? "none" : `1px solid ${black(0.05)}` }}
                  >
                    <p style={{ fontSize: 11 }}>
                      <span style={{ fontWeight: 500, color: INDIGO }}>{symbol}</span>{" "}
                      <span style={{ color: DIM }}>introuvable</span>
                    </p>
                    <button
                      type="button"
                      onClick={() => setWatchlist(watchlist.filter((item) => item !== symbol))}
                      aria-label={`Retirer ${symbol}`}
                      className="mk-hover"
                      style={{ fontSize: 11 }}
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Divider />

          <Label className="mb-3">Analyse IA</Label>
          {!insights ? (
            <SkeletonRows count={4} />
          ) : (
            <ul>
              {insights.map((insight) => (
                <li key={insight.text} className="mb-2 flex" style={{ background: BG, borderRadius: 8, padding: 9, gap: 8 }}>
                  <span aria-hidden style={{ fontSize: 14, lineHeight: 1.2 }}>{insight.icon}</span>
                  <p style={{ fontSize: 11, color: TEXT, lineHeight: 1.5 }}>{insight.text}</p>
                </li>
              ))}
            </ul>
          )}

          <Divider />

          <Label className="mb-2">Calendrier macro</Label>
          <p style={{ fontSize: 11, color: DIM, padding: "8px 0" }}>Bientôt disponible.</p>

          <p className="mt-auto text-center" style={{ fontSize: 9, color: DIM, fontStyle: "italic", paddingTop: 12, marginTop: 12, borderTop: `1px solid ${black(0.05)}` }}>
            Données en différé · Yahoo Finance
          </p>
        </aside>

        <section style={panel}>
          <Label className="mb-3">Mon portefeuille</Label>
          <form onSubmit={handleAddPortfolio} className="mb-3">
            <input
              value={portfolioInput}
              onChange={(e) => setPortfolioInput(e.target.value)}
              placeholder="AAPL 10"
              aria-label="Ajouter une position (SYMBOLE QUANTITÉ)"
              className="mk-input w-full"
              style={{ background: BG, border: `1px solid ${black(0.08)}`, borderRadius: 6, padding: "6px 10px", fontFamily: MONO, fontSize: 11, color: TEXT, outline: "none" }}
            />
          </form>
          {userPortfolio.length === 0 && !holdings ? (
            <p style={{ fontSize: 11, color: DIM, padding: "4px 0" }}>Ajoute un ticker pour suivre ton portefeuille.</p>
          ) : !holdings ? (
            <SkeletonRows count={5} />
          ) : (
            <>
              <ul style={{ fontVariantNumeric: "tabular-nums" }}>
                {holdings.positions.map((position) => (
                  <li key={position.symbol} className="flex items-center gap-2" style={{ padding: "8px 0", borderBottom: `1px solid ${black(0.05)}` }}>
                    <span className="min-w-0 truncate" style={{ fontSize: 11, fontWeight: 500, color: INDIGO }}>{position.symbol}</span>
                    <span className="shrink-0" style={{ fontSize: 10, color: DIM }}>{position.label}</span>
                    <span className="ml-auto shrink-0" style={{ fontSize: 11, color: TEXT }}>{money(position.value, position.currency)}</span>
                    <span className="shrink-0 text-right" style={{ width: 48, fontSize: 10, color: changeColor(position.changePercent) }}>
                      {formatPercent(position.changePercent)}
                    </span>
                    <button type="button" onClick={() => handleRemovePortfolio(position.id)} aria-label={`Retirer ${position.symbol}`} className="mk-hover shrink-0" style={{ fontSize: 11 }}>✕</button>
                  </li>
                ))}
              </ul>
              <p className="mt-3 flex flex-wrap items-baseline gap-x-2" style={{ fontVariantNumeric: "tabular-nums" }}>
                <span style={{ fontFamily: GEORGIA, fontSize: 20, color: TEXT }}>{money(holdings.total, "USD")}</span>
                <span style={{ fontSize: 12, color: changeColor(holdings.changePercent) }}>
                  {formatPercent(holdings.changePercent)} aujourd&apos;hui
                </span>
              </p>
            </>
          )}
        </section>
        </div>
      </div>

      {/* Zone 3 — news wire */}
      <section
        className="mx-5 overflow-hidden md:mx-8"
        style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 16, boxShadow: "0 2px 12px rgba(0,0,0,0.04)" }}
      >
        <div className="flex flex-wrap items-center justify-between gap-2" style={{ padding: "14px 20px", borderBottom: `1px solid ${BORDER}` }}>
          <div className="flex items-center" style={{ gap: 10 }}>
            <Label>Flux en surveillance</Label>
            <span aria-hidden style={{ width: 1, height: 12, background: black(0.08) }} />
            <PulseDot color={newsError ? GOLD : UP} />
            <span style={{ fontSize: 10, color: newsError ? "#8B6914" : UP }}>{newsError ? "Interrompu" : "En direct"}</span>
          </div>
          <div className="flex items-center" style={{ gap: 10 }}>
            <span style={{ fontSize: 10, color: text(0.35) }}>{news ? `${news.length} dépêches` : "…"}</span>
            <span aria-hidden style={{ width: 1, height: 12, background: black(0.08) }} />
            <span style={{ fontSize: 10, fontFamily: MONO, color: INDIGO }}>
              {newsLoadedAt ? newsLoadedAt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) : "--:--"}
            </span>
          </div>
        </div>

        <div className="mk-noscrollbar overflow-y-auto" style={{ maxHeight: 280 }}>
          {newsError ? (
            <div role="alert" className="text-center" style={{ padding: "32px 20px" }}>
              <p style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>Impossible de charger les actualités</p>
              <button
                type="button"
                onClick={loadNews}
                className="mk-hover mt-3"
                style={{ border: `1px solid ${black(0.12)}`, borderRadius: 8, fontSize: 12, padding: "6px 16px" }}
              >
                Réessayer
              </button>
            </div>
          ) : news === null ? (
            <div style={{ padding: "4px 20px" }}>
              <SkeletonRows count={6} />
            </div>
          ) : news.length === 0 ? (
            <p style={{ fontSize: 11, color: DIM, padding: 20 }}>Aucune dépêche pour l&apos;instant.</p>
          ) : (
            news.map((article, index) => {
              const time = new Date(article.publishedAt).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
              const source = (
                <span className="shrink-0 overflow-hidden text-ellipsis whitespace-nowrap" style={{ width: 90, fontSize: 10, color: text(index < TOP_WIRE ? 0.35 : 0.3) }}>
                  {article.source.name}
                </span>
              );

              // The three most recent dispatches are pinned at the top.
              if (index < TOP_WIRE) {
                return (
                  <div
                    key={article.url}
                    className="flex items-center gap-3"
                    style={{ padding: "12px 20px", background: "rgba(220,38,38,0.03)", borderLeft: `3px solid ${DOWN}`, borderBottom: `1px solid ${black(0.05)}` }}
                  >
                    <span className="shrink-0" style={{ background: DOWN, color: "#FFFFFF", fontSize: 8, fontWeight: 600, letterSpacing: "0.06em", padding: "2px 7px", borderRadius: 4 }}>
                      À LA UNE
                    </span>
                    <span className="shrink-0" style={{ width: 40, fontFamily: MONO, fontSize: 10, color: DOWN }}>{time}</span>
                    {source}
                    <button
                      type="button"
                      onClick={() => setSelectedArticle(article)}
                      className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-left"
                      style={{ fontSize: 12, fontWeight: 500, color: TEXT }}
                    >
                      {article.title}
                    </button>
                    <button type="button" onClick={() => setSelectedArticle(article)} className="shrink-0 hover:underline" style={{ fontSize: 10, color: DOWN }}>
                      Lire →
                    </button>
                  </div>
                );
              }

              const tag = newsTag(article);
              return (
                <button
                  key={article.url}
                  type="button"
                  onClick={() => setSelectedArticle(article)}
                  className="mk-line flex w-full items-center gap-3 text-left"
                  style={{ padding: "8px 20px", borderBottom: index < news.length - 1 ? `1px solid ${black(0.04)}` : "none" }}
                >
                  <span className="shrink-0" style={{ width: 40, fontFamily: MONO, fontSize: 10, color: INDIGO }}>{time}</span>
                  <span aria-hidden className="shrink-0" style={{ width: 1, height: 10, background: black(0.07) }} />
                  {source}
                  <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap" style={{ fontSize: 11, color: TEXT }}>
                    {article.title}
                  </span>
                  {tag && (
                    <span className="shrink-0" style={{ fontSize: 8, background: tag.background, color: tag.color, borderRadius: 4, padding: "1px 6px" }}>
                      {tag.label}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2" style={{ padding: "10px 20px", borderTop: `1px solid ${black(0.06)}` }}>
          <p style={{ fontSize: 9, color: text(0.25), fontStyle: "italic" }}>Données fournies par NewsAPI</p>
          <Link href="/actualites" className="hover:underline" style={{ fontSize: 10, color: INDIGO }}>
            Voir toutes les actualités →
          </Link>
        </div>
      </section>

      {selectedArticle && (
        <ArticleReader
          key={selectedArticle.url}
          article={selectedArticle}
          onClosed={closeReader}
          onShare={() => setSharing(selectedArticle)}
        />
      )}
      {sharing && <ShareModal article={sharing} user={session.user} onClose={() => setSharing(null)} />}
    </div>
  );
}

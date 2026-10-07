import { supabase } from "@/lib/supabase";

// ── Portfolio positions ──────────────────────────────────────────────────────
export type PortfolioPosition = {
  id: string;
  symbol: string;
  quantity: number;
  label: string;
};

const PORTFOLIO_KEY = "boredboard:portfolio";

export function readLocalPortfolio(): PortfolioPosition[] {
  try {
    const raw = localStorage.getItem(PORTFOLIO_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function writeLocalPortfolio(positions: PortfolioPosition[]) {
  try { localStorage.setItem(PORTFOLIO_KEY, JSON.stringify(positions)); } catch {}
}

export async function loadPortfolio(userId: string): Promise<PortfolioPosition[]> {
  const { data } = await supabase
    .from("user_portfolio")
    .select("id, symbol, quantity, label")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (data && data.length > 0) {
    const positions = data as PortfolioPosition[];
    writeLocalPortfolio(positions);
    return positions;
  }
  // Fallback to localStorage
  return readLocalPortfolio();
}

export async function addPortfolioPosition(userId: string, symbol: string, quantity: number, label: string): Promise<PortfolioPosition | null> {
  const { data, error } = await supabase
    .from("user_portfolio")
    .insert({ user_id: userId, symbol: symbol.toUpperCase(), quantity, label })
    .select("id, symbol, quantity, label")
    .single();
  if (error) {
    // Table may not exist yet — store locally
    const pos: PortfolioPosition = { id: crypto.randomUUID(), symbol: symbol.toUpperCase(), quantity, label };
    const local = readLocalPortfolio();
    local.push(pos);
    writeLocalPortfolio(local);
    return pos;
  }
  return data as PortfolioPosition;
}

export async function removePortfolioPosition(userId: string, positionId: string): Promise<void> {
  await supabase.from("user_portfolio").delete().eq("id", positionId).eq("user_id", userId);
  const local = readLocalPortfolio().filter((p) => p.id !== positionId);
  writeLocalPortfolio(local);
}

// ── Price alerts ─────────────────────────────────────────────────────────────
export type PriceAlert = {
  id: string;
  symbol: string;
  condition: "above" | "below";
  target: number;
  label: string;
};

const ALERTS_KEY = "boredboard:price-alerts";

export function readLocalAlerts(): PriceAlert[] {
  try {
    const raw = localStorage.getItem(ALERTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function writeLocalAlerts(alerts: PriceAlert[]) {
  try { localStorage.setItem(ALERTS_KEY, JSON.stringify(alerts)); } catch {}
}

export async function loadAlerts(userId: string): Promise<PriceAlert[]> {
  const { data } = await supabase
    .from("user_price_alerts")
    .select("id, symbol, condition, target, label")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (data && data.length > 0) {
    const alerts = data as PriceAlert[];
    writeLocalAlerts(alerts);
    return alerts;
  }
  return readLocalAlerts();
}

export async function addAlert(userId: string, symbol: string, condition: "above" | "below", target: number): Promise<PriceAlert | null> {
  const label = `${symbol} si ${condition === "above" ? ">" : "<"} ${target}`;
  const { data, error } = await supabase
    .from("user_price_alerts")
    .insert({ user_id: userId, symbol: symbol.toUpperCase(), condition, target, label })
    .select("id, symbol, condition, target, label")
    .single();
  if (error) {
    const alert: PriceAlert = { id: crypto.randomUUID(), symbol: symbol.toUpperCase(), condition, target, label };
    const local = readLocalAlerts();
    local.push(alert);
    writeLocalAlerts(local);
    return alert;
  }
  return data as PriceAlert;
}

export async function removeAlert(userId: string, alertId: string): Promise<void> {
  await supabase.from("user_price_alerts").delete().eq("id", alertId).eq("user_id", userId);
  const local = readLocalAlerts().filter((a) => a.id !== alertId);
  writeLocalAlerts(local);
}

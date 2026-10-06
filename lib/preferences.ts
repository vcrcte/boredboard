import { supabase } from "@/lib/supabase";

export const MODULES = [
  { id: "actualites", icon: "📰", name: "Actualités", description: "Articles de presse sélectionnés" },
  { id: "musique", icon: "🎵", name: "Musique", description: "Ce qu'écoutent tes contacts" },
  { id: "livres", icon: "📖", name: "Livres", description: "Lectures en cours dans ton réseau" },
  { id: "podcasts", icon: "🎙️", name: "Podcasts", description: "Épisodes partagés par tes contacts" },
  { id: "decouvertes", icon: "✦", name: "Découvertes", description: "Recommandations personnalisées" },
  { id: "marches", icon: "📈", name: "Marchés", description: "Flash des marchés financiers" },
  { id: "reactions", icon: "💬", name: "Réactions", description: "Commentaires et débats du moment" },
] as const;

export type ModuleId = (typeof MODULES)[number]["id"];

export const THEMES = [
  "Géopolitique",
  "Histoire",
  "Philosophie",
  "Science",
  "Tech",
  "Art",
  "Littérature",
  "Économie",
  "Cinéma",
  "Architecture",
  "Musique",
  "Voyage",
] as const;

export const FEED_ORDERS = [
  { id: "equilibre", icon: "⚖️", name: "Équilibré", description: "Mix de social et d'actualités" },
  { id: "social", icon: "👥", name: "Social first", description: "Priorité aux partages de tes contacts" },
  { id: "actualites", icon: "📰", name: "Actualités first", description: "Priorité aux dernières nouvelles" },
] as const;

export type FeedOrder = (typeof FEED_ORDERS)[number]["id"];

export type Preferences = {
  modules: Record<ModuleId, boolean>;
  /** Display order of the modules in the feed and Customizer. */
  moduleOrder: ModuleId[];
  themes: string[];
  order: FeedOrder;
};

export const STORAGE_KEY = "boredboard-preferences";

export const DEFAULT_MODULE_ORDER: ModuleId[] = MODULES.map((module) => module.id);

export const DEFAULT_PREFERENCES: Preferences = {
  modules: Object.fromEntries(MODULES.map((module) => [module.id, true])) as Record<ModuleId, boolean>,
  moduleOrder: DEFAULT_MODULE_ORDER,
  themes: [],
  order: "equilibre",
};

/** Keeps only known values, so a stale or hand-edited copy can't break the feed. */
export function sanitizePreferences(value: unknown): Preferences | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Partial<Preferences>;
  const modules = { ...DEFAULT_PREFERENCES.modules };
  for (const entry of MODULES) {
    if (typeof raw.modules?.[entry.id] === "boolean") modules[entry.id] = raw.modules[entry.id];
  }
  const themes = Array.isArray(raw.themes)
    ? raw.themes.filter((theme): theme is string => (THEMES as readonly string[]).includes(theme))
    : [];
  const order = FEED_ORDERS.some((option) => option.id === raw.order) ? (raw.order as FeedOrder) : "equilibre";
  const knownIds = new Set<string>(MODULES.map((m) => m.id));
  const moduleOrder: ModuleId[] = Array.isArray((raw as Record<string, unknown>).moduleOrder)
    ? ((raw as Record<string, unknown>).moduleOrder as string[]).filter((id): id is ModuleId => knownIds.has(id))
    : [];
  // Append any modules missing from the saved order (new modules added after the user saved).
  for (const m of MODULES) {
    if (!moduleOrder.includes(m.id)) moduleOrder.push(m.id);
  }
  return { modules, moduleOrder, themes, order };
}

export function readLocalPreferences(): Preferences | null {
  try {
    return sanitizePreferences(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null"));
  } catch {
    return null;
  }
}

function writeLocalPreferences(preferences: Preferences) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
  } catch {
    // Storage unavailable: the Supabase copy is all there is.
  }
}

/** Reads the copy saved on the profile; null when there is none or the column doesn't exist yet. */
export async function readRemotePreferences(userId: string): Promise<Preferences | null> {
  // Queried on its own so a missing column can't break the main profile query.
  const { data, error } = await supabase.from("profiles").select("preferences").eq("id", userId).maybeSingle();
  if (error || !data) return null;
  const preferences = sanitizePreferences(data.preferences);
  if (preferences) writeLocalPreferences(preferences);
  return preferences;
}

/** Saves locally first, then on the profile. Returns whether the Supabase copy was written. */
export async function savePreferences(userId: string, preferences: Preferences): Promise<boolean> {
  writeLocalPreferences(preferences);
  const { error } = await supabase.from("profiles").update({ preferences }).eq("id", userId);
  return !error;
}

const THEME_QUERIES: Record<string, string> = {
  Géopolitique: "géopolitique",
  Histoire: "histoire",
  Philosophie: "philosophie",
  Science: "science",
  Tech: "technologie",
  Art: "art",
  Littérature: "littérature",
  Économie: "économie",
  Cinéma: "cinéma",
  Architecture: "architecture",
  Musique: "musique",
  Voyage: "voyage",
};

/** NewsAPI search matching any of the chosen themes; empty when none is chosen. */
export function themesQuery(themes: string[]) {
  return themes.map((theme) => THEME_QUERIES[theme] ?? theme).join(" OR ");
}

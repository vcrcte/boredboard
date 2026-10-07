import { supabase } from "@/lib/supabase";

// ── Series sources ────────────────────────────────────────────────────
// Curated series recommendations the community can browse and save.

export type SeriesSource = {
  id: string;
  name: string;
  description: string;
  genre: string;
  icon: string;
  platform: "Netflix" | "Disney+" | "Prime Video" | "Apple TV+" | "Canal+" | "Arte" | "OCS" | "France TV";
  year: number;
  seasons: number;
  url: string;
  trailer_url: string | null;
  color: string;
};

export const SERIES_SOURCES: SeriesSource[] = [
  // ── Thriller / Drame ──
  {
    id: "the-bureau",
    name: "Le Bureau des Légendes",
    description: "Plongée dans les opérations clandestines de la DGSE — la meilleure série d'espionnage française",
    genre: "Thriller",
    icon: "🕵️",
    platform: "Canal+",
    year: 2015,
    seasons: 5,
    url: "https://www.canalplus.com/series/le-bureau-des-legendes",
    trailer_url: "https://www.youtube.com/watch?v=Bj0E2hxj76A",
    color: "#1B1B2F",
  },
  {
    id: "lupin",
    name: "Lupin",
    description: "Assane Diop s'inspire d'Arsène Lupin pour venger son père — Omar Sy au sommet",
    genre: "Thriller",
    icon: "🎩",
    platform: "Netflix",
    year: 2021,
    seasons: 3,
    url: "https://www.netflix.com/title/80994082",
    trailer_url: "https://www.youtube.com/watch?v=ga0iTWXCGa0",
    color: "#E50914",
  },
  {
    id: "la-flamme",
    name: "La Flamme",
    description: "Parodie hilarante des émissions de télé-réalité romantiques — Jonathan Cohen inoubliable",
    genre: "Comédie",
    icon: "🔥",
    platform: "Canal+",
    year: 2020,
    seasons: 1,
    url: "https://www.canalplus.com/series/la-flamme",
    trailer_url: "https://www.youtube.com/watch?v=n6oXkRfPi_g",
    color: "#FF6B35",
  },
  {
    id: "dix-pour-cent",
    name: "Dix pour cent",
    description: "Les coulisses d'une agence de stars parisienne — humour et émotion avec de vrais acteurs en guests",
    genre: "Comédie dramatique",
    icon: "🎬",
    platform: "Netflix",
    year: 2015,
    seasons: 4,
    url: "https://www.netflix.com/title/80133335",
    trailer_url: "https://www.youtube.com/watch?v=WLOBXz2A2sY",
    color: "#C4A94A",
  },
  {
    id: "en-therapie",
    name: "En thérapie",
    description: "Un psychanalyste et ses patients après les attentats du 13 novembre — intense et intime",
    genre: "Drame",
    icon: "🛋️",
    platform: "Arte",
    year: 2021,
    seasons: 2,
    url: "https://www.arte.tv/fr/videos/RC-020578/en-therapie/",
    trailer_url: "https://www.youtube.com/watch?v=j4_wL4eCsNY",
    color: "#534AB7",
  },
  {
    id: "ovni",
    name: "OVNI(s)",
    description: "Années 70, une équipe du CNES enquête sur les OVNI — drôle, décalé, visuellement superbe",
    genre: "Comédie SF",
    icon: "🛸",
    platform: "Canal+",
    year: 2021,
    seasons: 2,
    url: "https://www.canalplus.com/series/ovni-s",
    trailer_url: "https://www.youtube.com/watch?v=AYZ_OdVbKfs",
    color: "#0F4C75",
  },
  {
    id: "hpi",
    name: "HPI",
    description: "Une femme de ménage surdouée aide la police — Audrey Fleurot dans un rôle déjanté",
    genre: "Policier",
    icon: "🧠",
    platform: "France TV",
    year: 2021,
    seasons: 4,
    url: "https://www.france.tv/france-2/hpi/",
    trailer_url: null,
    color: "#16A34A",
  },
  {
    id: "validé",
    name: "Validé",
    description: "L'ascension d'un rappeur dans le monde impitoyable du rap français — Franck Gastambide",
    genre: "Drame musical",
    icon: "🎤",
    platform: "Canal+",
    year: 2020,
    seasons: 2,
    url: "https://www.canalplus.com/series/valide",
    trailer_url: "https://www.youtube.com/watch?v=qK53CEuMgZ8",
    color: "#8B6914",
  },
  {
    id: "drole",
    name: "Drôle",
    description: "Quatre stand-uppers à Paris entre ambition, doutes et scènes ouvertes",
    genre: "Comédie dramatique",
    icon: "😂",
    platform: "Netflix",
    year: 2022,
    seasons: 2,
    url: "https://www.netflix.com/title/81252926",
    trailer_url: null,
    color: "#993556",
  },
  {
    id: "minerva",
    name: "Mytho",
    description: "Une mère de famille invente une maladie pour retrouver l'attention de ses proches — grinçant et humain",
    genre: "Comédie noire",
    icon: "🎭",
    platform: "Arte",
    year: 2019,
    seasons: 2,
    url: "https://www.arte.tv/fr/videos/RC-018219/mytho/",
    trailer_url: null,
    color: "#6B4226",
  },
  {
    id: "au-service-de-la-france",
    name: "Au service de la France",
    description: "Comédie d'espionnage dans la France gaulliste des années 60 — absurde et brillant",
    genre: "Comédie",
    icon: "🇫🇷",
    platform: "Arte",
    year: 2015,
    seasons: 2,
    url: "https://www.arte.tv/fr/videos/RC-014428/au-service-de-la-france/",
    trailer_url: null,
    color: "#2A3560",
  },
  {
    id: "plan-coeur",
    name: "Plan Cœur",
    description: "Les amies d'Elsa embauchent un escort pour lui faire oublier son ex — comédie romantique parisienne",
    genre: "Comédie romantique",
    icon: "💕",
    platform: "Netflix",
    year: 2018,
    seasons: 3,
    url: "https://www.netflix.com/title/80996601",
    trailer_url: null,
    color: "#D4537E",
  },
];

// ── Watchlist management ────────────────────────────────────────────────

export type SeriesWatchlistItem = {
  id: string;
  user_id: string;
  series_id: string;
  status: "à voir" | "en cours" | "terminé";
  created_at: string;
};

export async function getUserWatchlist(userId: string): Promise<SeriesWatchlistItem[]> {
  const { data } = await supabase
    .from("series_watchlist")
    .select("id, user_id, series_id, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function addToWatchlist(userId: string, seriesId: string, status: SeriesWatchlistItem["status"] = "à voir"): Promise<boolean> {
  const { error } = await supabase
    .from("series_watchlist")
    .upsert({ user_id: userId, series_id: seriesId, status }, { onConflict: "user_id,series_id" });
  return !error;
}

export async function updateWatchlistStatus(userId: string, seriesId: string, status: SeriesWatchlistItem["status"]): Promise<boolean> {
  const { error } = await supabase
    .from("series_watchlist")
    .update({ status })
    .eq("user_id", userId)
    .eq("series_id", seriesId);
  return !error;
}

export async function removeFromWatchlist(userId: string, seriesId: string): Promise<boolean> {
  const { error } = await supabase
    .from("series_watchlist")
    .delete()
    .eq("user_id", userId)
    .eq("series_id", seriesId);
  return !error;
}

// ── Helpers ─────────────────────────────────────────────────────────────

export function getSeriesGenres(): string[] {
  return [...new Set(SERIES_SOURCES.map((s) => s.genre))];
}

export function getSeriesPlatforms(): string[] {
  return [...new Set(SERIES_SOURCES.map((s) => s.platform))];
}

export function platformColor(p: SeriesSource["platform"]): string {
  const map: Record<string, string> = {
    "Netflix": "#E50914",
    "Disney+": "#113CCF",
    "Prime Video": "#00A8E1",
    "Apple TV+": "#000000",
    "Canal+": "#1A1A1A",
    "Arte": "#F47920",
    "OCS": "#FF6600",
    "France TV": "#0F6E56",
  };
  return map[p] ?? "#2A3560";
}

import { supabase } from "@/lib/supabase";

// ── Podcast sources ───────────────────────────────────────────────────
// Curated French cultural podcasts the user can subscribe to. Each maps
// to a theme and links to a listening platform + optional RSS feed.

export type PodcastSource = {
  id: string;
  name: string;
  description: string;
  theme: string;
  icon: string;
  frequency: "quotidien" | "hebdo" | "bimensuel" | "mensuel";
  /** Main website / landing page. */
  url: string;
  /** RSS feed URL (used server-side to pull latest episodes). */
  feed_url: string | null;
  /** Apple Podcasts link (for listen button). */
  apple_url: string | null;
  /** Spotify link (for listen button). */
  spotify_url: string | null;
  /** Preview color for the card. */
  color: string;
};

export const PODCAST_SOURCES: PodcastSource[] = [
  // ── Géopolitique ──
  {
    id: "le-dessous-des-cartes",
    name: "Le dessous des cartes",
    description: "Géopolitique décryptée par les cartes — Arte",
    theme: "Géopolitique",
    icon: "🗺️",
    frequency: "hebdo",
    url: "https://www.arte.tv/fr/videos/RC-014036/le-dessous-des-cartes/",
    feed_url: null,
    apple_url: "https://podcasts.apple.com/fr/podcast/le-dessous-des-cartes-arte/id1458music36",
    spotify_url: "https://open.spotify.com/show/1VmBGmnYJoSDVrcCToAaEP",
    color: "#1B4332",
  },
  {
    id: "affaires-etrangeres",
    name: "Affaires étrangères",
    description: "Les grandes questions internationales — France Culture",
    theme: "Géopolitique",
    icon: "🌐",
    frequency: "hebdo",
    url: "https://www.radiofrance.fr/franceculture/podcasts/affaires-etrangeres",
    feed_url: "https://radiofrance-podcast.net/podcast09/rss_15408.xml",
    apple_url: null,
    spotify_url: null,
    color: "#0F4C75",
  },
  // ── Histoire ──
  {
    id: "au-coeur-de-lhistoire",
    name: "Au cœur de l'histoire",
    description: "Récits historiques immersifs — Europe 1",
    theme: "Histoire",
    icon: "⏳",
    frequency: "quotidien",
    url: "https://www.europe1.fr/emissions/au-coeur-de-l-histoire",
    feed_url: "https://www.europe1.fr/rss/podcasts/au-coeur-de-l-histoire.xml",
    apple_url: "https://podcasts.apple.com/fr/podcast/au-c%C5%93ur-de-lhistoire/id1460971145",
    spotify_url: "https://open.spotify.com/show/3jLEwMxVCjmXmKfCjMPHAp",
    color: "#8B6914",
  },
  {
    id: "les-grandes-traversees",
    name: "Les Grandes Traversées",
    description: "Séries documentaires historiques d'exception — France Culture",
    theme: "Histoire",
    icon: "📜",
    frequency: "mensuel",
    url: "https://www.radiofrance.fr/franceculture/podcasts/grandes-traversees",
    feed_url: null,
    apple_url: null,
    spotify_url: null,
    color: "#6B4226",
  },
  // ── Philosophie ──
  {
    id: "les-chemins-de-la-philosophie",
    name: "Les Chemins de la philosophie",
    description: "Grands penseurs et questions philosophiques — France Culture",
    theme: "Philosophie",
    icon: "🤔",
    frequency: "quotidien",
    url: "https://www.radiofrance.fr/franceculture/podcasts/les-chemins-de-la-philosophie",
    feed_url: "https://radiofrance-podcast.net/podcast09/rss_10467.xml",
    apple_url: "https://podcasts.apple.com/fr/podcast/les-chemins-de-la-philosophie/id278118789",
    spotify_url: "https://open.spotify.com/show/71JhJkVOu8JMZvGsdz1DNI",
    color: "#534AB7",
  },
  // ── Science ──
  {
    id: "la-methode-scientifique",
    name: "La Méthode scientifique",
    description: "L'actualité de la recherche et les grandes découvertes — France Culture",
    theme: "Science",
    icon: "🔬",
    frequency: "quotidien",
    url: "https://www.radiofrance.fr/franceculture/podcasts/la-methode-scientifique",
    feed_url: "https://radiofrance-podcast.net/podcast09/rss_14312.xml",
    apple_url: "https://podcasts.apple.com/fr/podcast/la-m%C3%A9thode-scientifique/id1166081686",
    spotify_url: "https://open.spotify.com/show/2FAPrej0dMYlUHTWjNObnQ",
    color: "#0F6E56",
  },
  {
    id: "la-terre-au-carre",
    name: "La Terre au carré",
    description: "Nature, écologie et environnement — France Inter",
    theme: "Science",
    icon: "🌿",
    frequency: "quotidien",
    url: "https://www.radiofrance.fr/franceinter/podcasts/la-terre-au-carre",
    feed_url: "https://radiofrance-podcast.net/podcast09/rss_16361.xml",
    apple_url: null,
    spotify_url: null,
    color: "#1D9E75",
  },
  // ── Tech ──
  {
    id: "le-code-a-change",
    name: "Le Code a changé",
    description: "Comment le numérique transforme nos vies — France Inter",
    theme: "Tech",
    icon: "💻",
    frequency: "bimensuel",
    url: "https://www.radiofrance.fr/franceinter/podcasts/le-code-a-change",
    feed_url: "https://radiofrance-podcast.net/podcast09/rss_18994.xml",
    apple_url: "https://podcasts.apple.com/fr/podcast/le-code-a-chang%C3%A9/id1455189322",
    spotify_url: "https://open.spotify.com/show/4RlXSmzLMaG5cFJOEBFSvW",
    color: "#2A3560",
  },
  // ── Art & Culture ──
  {
    id: "les-regards-de-lart",
    name: "Les Regardeurs",
    description: "Analyse d'œuvres d'art en détail — France Culture",
    theme: "Art",
    icon: "🎨",
    frequency: "hebdo",
    url: "https://www.radiofrance.fr/franceculture/podcasts/les-regardeurs",
    feed_url: null,
    apple_url: null,
    spotify_url: null,
    color: "#993556",
  },
  // ── Littérature ──
  {
    id: "le-book-club",
    name: "Le Book Club",
    description: "Rencontres avec les auteurs et autrices — France Culture",
    theme: "Littérature",
    icon: "📚",
    frequency: "hebdo",
    url: "https://www.radiofrance.fr/franceculture/podcasts/le-book-club",
    feed_url: "https://radiofrance-podcast.net/podcast09/rss_21258.xml",
    apple_url: null,
    spotify_url: null,
    color: "#3B6D11",
  },
  // ── Économie ──
  {
    id: "splash",
    name: "Splash",
    description: "L'économie racontée autrement — Nouvelles Écoutes",
    theme: "Économie",
    icon: "💰",
    frequency: "bimensuel",
    url: "https://nouvellesecoutes.fr/podcast/splash/",
    feed_url: null,
    apple_url: "https://podcasts.apple.com/fr/podcast/splash/id1448768427",
    spotify_url: "https://open.spotify.com/show/5oJlGJPhPGFSYInVQ9e5ve",
    color: "#C4A94A",
  },
  // ── Cinéma ──
  {
    id: "le-cercle-cinema",
    name: "Le Cercle Cinéma",
    description: "Débats et critiques sur les films à l'affiche — Canal+",
    theme: "Cinéma",
    icon: "🎬",
    frequency: "hebdo",
    url: "https://www.canalplus.com/emissions/le-cercle-cinema",
    feed_url: null,
    apple_url: null,
    spotify_url: null,
    color: "#C0392B",
  },
  // ── Musique ──
  {
    id: "radio-nova-la-selektion",
    name: "La Sélection Nova",
    description: "Découvertes musicales et playlists éclectiques — Radio Nova",
    theme: "Musique",
    icon: "🎧",
    frequency: "hebdo",
    url: "https://www.nova.fr/podcasts/",
    feed_url: null,
    apple_url: null,
    spotify_url: null,
    color: "#834DFF",
  },
  // ── Voyage ──
  {
    id: "les-baladeurs",
    name: "Les Baladeurs",
    description: "Récits d'aventures et de voyages extraordinaires",
    theme: "Voyage",
    icon: "🥾",
    frequency: "bimensuel",
    url: "https://lesothers.com/les-baladeurs-podcast",
    feed_url: "https://feeds.audiomeans.fr/feed/97c02370-4e7a-406b-b326-46f3537ea044.xml",
    apple_url: "https://podcasts.apple.com/fr/podcast/les-baladeurs/id1440music30",
    spotify_url: "https://open.spotify.com/show/3xvnKxXxSYFg5WjCBLYCdH",
    color: "#0F4C75",
  },
  // ── Architecture ──
  {
    id: "archi-urbain",
    name: "Métropolitains",
    description: "Urbanisme, architecture et vie en ville — France Culture",
    theme: "Architecture",
    icon: "🏛️",
    frequency: "hebdo",
    url: "https://www.radiofrance.fr/franceculture/podcasts/metropolitains",
    feed_url: null,
    apple_url: null,
    spotify_url: null,
    color: "#1C1A15",
  },
];

// ── Subscription management ────────────────────────────────────────────

export type PodcastSubscription = {
  id: string;
  user_id: string;
  source_id: string;
  created_at: string;
};

/** Get all podcast subscriptions for a user. */
export async function getUserPodcastSubscriptions(userId: string): Promise<PodcastSubscription[]> {
  const { data } = await supabase
    .from("podcast_subscriptions")
    .select("id, user_id, source_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Subscribe to a podcast source. */
export async function subscribePodcast(userId: string, sourceId: string): Promise<boolean> {
  const { error } = await supabase
    .from("podcast_subscriptions")
    .upsert({ user_id: userId, source_id: sourceId }, { onConflict: "user_id,source_id" });
  return !error;
}

/** Unsubscribe from a podcast source. */
export async function unsubscribePodcast(userId: string, sourceId: string): Promise<boolean> {
  const { error } = await supabase
    .from("podcast_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("source_id", sourceId);
  return !error;
}

// ── Helpers ─────────────────────────────────────────────────────────────

export function podcastFrequencyLabel(f: PodcastSource["frequency"]): string {
  return f === "quotidien" ? "Quotidien" : f === "hebdo" ? "Hebdomadaire" : f === "bimensuel" ? "Bimensuel" : "Mensuel";
}

export function getPodcastThemes(): string[] {
  return [...new Set(PODCAST_SOURCES.map((s) => s.theme))];
}

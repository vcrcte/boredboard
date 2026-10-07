import { supabase } from "@/lib/supabase";

// ── YouTube channel sources ───────────────────────────────────────────
// Curated French cultural YouTube channels.

export type VideoSource = {
  id: string;
  name: string;
  description: string;
  theme: string;
  icon: string;
  channel_url: string;
  /** A recent/popular video to embed */
  featured_video_id: string;
  color: string;
};

export const VIDEO_SOURCES: VideoSource[] = [
  // ── Science ──
  {
    id: "sciencesetonnantes",
    name: "ScienceÉtonnante",
    description: "Physique, maths et sciences de pointe vulgarisées avec rigueur et humour — David Louapre",
    theme: "Science",
    icon: "🔬",
    channel_url: "https://www.youtube.com/@ScienceEtonnante",
    featured_video_id: "JKMq7-hlSUY",
    color: "#0F6E56",
  },
  {
    id: "dirtybiology",
    name: "Dirty Biology",
    description: "La biologie comme vous ne l'avez jamais vue — Léo Grasset explore le vivant",
    theme: "Science",
    icon: "🧬",
    channel_url: "https://www.youtube.com/@DirtyBiology",
    featured_video_id: "ppHa1cUxPaA",
    color: "#16A34A",
  },
  // ── Histoire ──
  {
    id: "notabene",
    name: "Nota Bene",
    description: "L'Histoire avec un grand H racontée de façon captivante — Benjamin Brillaud",
    theme: "Histoire",
    icon: "⚔️",
    channel_url: "https://www.youtube.com/@NotaBeneMusic",
    featured_video_id: "zyykfxmOEFE",
    color: "#8B6914",
  },
  {
    id: "lhistoirenousledira",
    name: "L'Histoire nous le dira",
    description: "Anecdotes historiques passionnantes par Laurent Turcot — prof québécois adoré en France",
    theme: "Histoire",
    icon: "📜",
    channel_url: "https://www.youtube.com/@LHistoirenousledira",
    featured_video_id: "g3kv8EJoXe4",
    color: "#6B4226",
  },
  // ── Philosophie ──
  {
    id: "monsieurphi",
    name: "Monsieur Phi",
    description: "Philosophie analytique, logique et pensée critique — rigoureux et accessible",
    theme: "Philosophie",
    icon: "🤔",
    channel_url: "https://www.youtube.com/@MonsieurPhi",
    featured_video_id: "EvGOlAkMSfQ",
    color: "#534AB7",
  },
  // ── Économie ──
  {
    id: "heureka",
    name: "Heu?reka",
    description: "Finance et économie décortiquées — le meilleur vulgarisateur éco francophone",
    theme: "Économie",
    icon: "📊",
    channel_url: "https://www.youtube.com/@Heureka",
    featured_video_id: "nUBbklRUB00",
    color: "#C4A94A",
  },
  // ── Tech ──
  {
    id: "sciencedecomptoir",
    name: "Science de comptoir",
    description: "Technologies et innovations expliquées avec des expériences — Valentin",
    theme: "Tech",
    icon: "⚡",
    channel_url: "https://www.youtube.com/@ScienceDeComptoir",
    featured_video_id: "PCBl98X3pM0",
    color: "#2A3560",
  },
  // ── Art & Culture ──
  {
    id: "artediscovery",
    name: "ARTE Discovery",
    description: "Les meilleurs documentaires d'ARTE en accès libre — culture, société, nature",
    theme: "Documentaire",
    icon: "🎥",
    channel_url: "https://www.youtube.com/@ARTEDiscovery",
    featured_video_id: "YPB7MfkpG-g",
    color: "#F47920",
  },
  {
    id: "mustreaming",
    name: "Mustreaming",
    description: "Analyse de films et séries, critique cinéma accessible et passionnée",
    theme: "Cinéma",
    icon: "🍿",
    channel_url: "https://www.youtube.com/@Mustreaming",
    featured_video_id: "fKMnCzqKmIM",
    color: "#C0392B",
  },
  // ── Géopolitique ──
  {
    id: "lpm",
    name: "Le Monde",
    description: "Vidéos d'actualité et décryptages géopolitiques du quotidien de référence",
    theme: "Géopolitique",
    icon: "🌍",
    channel_url: "https://www.youtube.com/@LeMonde",
    featured_video_id: "Kg-FbPDMBqA",
    color: "#1B4332",
  },
  {
    id: "hugodecrypte",
    name: "Hugo Décrypte",
    description: "L'actu décryptée pour les jeunes — le média le plus suivi de la génération Z",
    theme: "Actualité",
    icon: "📱",
    channel_url: "https://www.youtube.com/@HugoDecrypte",
    featured_video_id: "e8ePL4IjRMQ",
    color: "#0F4C75",
  },
  // ── Musique ──
  {
    id: "musicien2zero",
    name: "PV Nova",
    description: "Expériences musicales créatives et défis — un musicien multi-instrumentiste inventif",
    theme: "Musique",
    icon: "🎵",
    channel_url: "https://www.youtube.com/@PVNova",
    featured_video_id: "K5KAc5CoCuk",
    color: "#834DFF",
  },
];

// ── Subscription management ────────────────────────────────────────────

export type VideoSubscription = {
  id: string;
  user_id: string;
  source_id: string;
  created_at: string;
};

export async function getUserVideoSubscriptions(userId: string): Promise<VideoSubscription[]> {
  const { data } = await supabase
    .from("video_subscriptions")
    .select("id, user_id, source_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function subscribeVideo(userId: string, sourceId: string): Promise<boolean> {
  const { error } = await supabase
    .from("video_subscriptions")
    .upsert({ user_id: userId, source_id: sourceId }, { onConflict: "user_id,source_id" });
  return !error;
}

export async function unsubscribeVideo(userId: string, sourceId: string): Promise<boolean> {
  const { error } = await supabase
    .from("video_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("source_id", sourceId);
  return !error;
}

// ── Helpers ─────────────────────────────────────────────────────────────

export function getVideoThemes(): string[] {
  return [...new Set(VIDEO_SOURCES.map((s) => s.theme))];
}

import { supabase } from "@/lib/supabase";

// ── Newsletter sources ─────────────────────────────────────────────────
// Curated newsletters the user can subscribe to. Each one maps to a theme
// and provides a real RSS/Atom feed or website. The digest pulls articles
// from the user's subscribed sources.

export type NewsletterSource = {
  id: string;
  name: string;
  description: string;
  theme: string;
  icon: string;
  frequency: "quotidien" | "hebdo" | "mensuel";
  url: string;
  /** RSS/Atom feed URL (used server-side to pull latest articles). */
  feed_url: string | null;
  /** Preview color for the card. */
  color: string;
};

export const NEWSLETTER_SOURCES: NewsletterSource[] = [
  // ── Géopolitique & Actualités ──
  {
    id: "le-grand-continent",
    name: "Le Grand Continent",
    description: "Analyses géopolitiques et grandes tendances internationales",
    theme: "Géopolitique",
    icon: "🌍",
    frequency: "hebdo",
    url: "https://legrandcontinent.eu",
    feed_url: "https://legrandcontinent.eu/fr/feed/",
    color: "#1B4332",
  },
  {
    id: "courrier-international",
    name: "Courrier International",
    description: "Le meilleur de la presse étrangère traduit en français",
    theme: "Géopolitique",
    icon: "📬",
    frequency: "quotidien",
    url: "https://www.courrierinternational.com",
    feed_url: null,
    color: "#0F4C75",
  },
  // ── Histoire ──
  {
    id: "retronews",
    name: "RetroNews",
    description: "La presse d'hier racontée aux lecteurs d'aujourd'hui",
    theme: "Histoire",
    icon: "📜",
    frequency: "hebdo",
    url: "https://www.retronews.fr",
    feed_url: null,
    color: "#8B6914",
  },
  // ── Philosophie ──
  {
    id: "philosophie-magazine",
    name: "Philosophie Magazine",
    description: "Grandes questions philosophiques et pensée contemporaine",
    theme: "Philosophie",
    icon: "🤔",
    frequency: "hebdo",
    url: "https://www.philomag.com",
    feed_url: "https://www.philomag.com/feed",
    color: "#534AB7",
  },
  // ── Science ──
  {
    id: "science-etonnante",
    name: "Science Étonnante",
    description: "Vulgarisation scientifique claire et passionnante",
    theme: "Science",
    icon: "🔬",
    frequency: "hebdo",
    url: "https://scienceetonnante.com",
    feed_url: "https://scienceetonnante.com/feed/",
    color: "#0F6E56",
  },
  {
    id: "futura-sciences",
    name: "Futura Sciences",
    description: "Actualités science, santé, tech et environnement",
    theme: "Science",
    icon: "🧪",
    frequency: "quotidien",
    url: "https://www.futura-sciences.com",
    feed_url: "https://www.futura-sciences.com/rss/actualites.xml",
    color: "#1D9E75",
  },
  // ── Tech ──
  {
    id: "next-ink",
    name: "Next.ink",
    description: "Analyses tech, numérique et droits numériques",
    theme: "Tech",
    icon: "💻",
    frequency: "quotidien",
    url: "https://next.ink",
    feed_url: null,
    color: "#2A3560",
  },
  {
    id: "korii",
    name: "Korii",
    description: "Futur, tech et pop culture — par Slate",
    theme: "Tech",
    icon: "🚀",
    frequency: "quotidien",
    url: "https://korii.slate.fr",
    feed_url: "https://korii.slate.fr/rss.xml",
    color: "#6B3FD4",
  },
  // ── Art ──
  {
    id: "beaux-arts",
    name: "Beaux Arts Magazine",
    description: "Actualité de l'art contemporain et des expositions",
    theme: "Art",
    icon: "🎨",
    frequency: "hebdo",
    url: "https://www.beauxarts.com",
    feed_url: null,
    color: "#993556",
  },
  // ── Littérature ──
  {
    id: "en-attendant-nadeau",
    name: "En attendant Nadeau",
    description: "Revue littéraire indépendante et exigeante",
    theme: "Littérature",
    icon: "📚",
    frequency: "hebdo",
    url: "https://www.en-attendant-nadeau.fr",
    feed_url: "https://www.en-attendant-nadeau.fr/feed/",
    color: "#3B6D11",
  },
  // ── Économie ──
  {
    id: "brief-eco",
    name: "Brief.eco",
    description: "L'économie expliquée simplement, chaque semaine",
    theme: "Économie",
    icon: "📊",
    frequency: "hebdo",
    url: "https://brief.eco",
    feed_url: null,
    color: "#8B6914",
  },
  // ── Cinéma ──
  {
    id: "les-inrocks-cinema",
    name: "Les Inrocks — Cinéma",
    description: "Critiques et actualité du cinéma indépendant",
    theme: "Cinéma",
    icon: "🎬",
    frequency: "hebdo",
    url: "https://www.lesinrocks.com/cinema/",
    feed_url: null,
    color: "#C0392B",
  },
  // ── Musique ──
  {
    id: "les-inrocks-musique",
    name: "Les Inrocks — Musique",
    description: "Découvertes musicales et interviews d'artistes",
    theme: "Musique",
    icon: "🎵",
    frequency: "hebdo",
    url: "https://www.lesinrocks.com/musique/",
    feed_url: null,
    color: "#834DFF",
  },
  // ── Architecture ──
  {
    id: "archdaily-fr",
    name: "ArchDaily",
    description: "Projets architecturaux, design et urbanisme",
    theme: "Architecture",
    icon: "🏛️",
    frequency: "quotidien",
    url: "https://www.archdaily.com",
    feed_url: "https://www.archdaily.com/feed",
    color: "#1C1A15",
  },
  // ── Voyage ──
  {
    id: "geo-voyage",
    name: "GEO",
    description: "Récits de voyage, découvertes et photographies du monde",
    theme: "Voyage",
    icon: "✈️",
    frequency: "hebdo",
    url: "https://www.geo.fr",
    feed_url: "https://www.geo.fr/rss.xml",
    color: "#0F4C75",
  },
];

// ── Subscription management ────────────────────────────────────────────

export type Subscription = {
  id: string;
  user_id: string;
  source_id: string;
  created_at: string;
};

/** Get all subscriptions for a user. */
export async function getUserSubscriptions(userId: string): Promise<Subscription[]> {
  const { data } = await supabase
    .from("newsletter_subscriptions")
    .select("id, user_id, source_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

/** Subscribe to a newsletter source. */
export async function subscribe(userId: string, sourceId: string): Promise<boolean> {
  const { error } = await supabase
    .from("newsletter_subscriptions")
    .upsert({ user_id: userId, source_id: sourceId }, { onConflict: "user_id,source_id" });
  return !error;
}

/** Unsubscribe from a newsletter source. */
export async function unsubscribe(userId: string, sourceId: string): Promise<boolean> {
  const { error } = await supabase
    .from("newsletter_subscriptions")
    .delete()
    .eq("user_id", userId)
    .eq("source_id", sourceId);
  return !error;
}

// ── Digest generation ──────────────────────────────────────────────────

export type DigestSection = {
  title: string;
  icon: string;
  items: DigestItem[];
};

export type DigestItem = {
  title: string;
  description: string;
  source: string;
  url: string | null;
  time: string;
};

/**
 * Build a digest preview from the user's recent activity and their
 * subscribed newsletter themes.  This runs client-side and pulls from:
 *  1. The user's own posts from the last 7 days
 *  2. Posts from people they follow in the last 7 days
 *  3. A "recommended reading" stub from subscribed sources
 */
export async function buildDigestPreview(
  userId: string,
  subscribedSourceIds: string[],
): Promise<DigestSection[]> {
  const weekAgo = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const sections: DigestSection[] = [];

  // 1. User's own activity
  const { data: myPosts } = await supabase
    .from("posts")
    .select("type, content, url, created_at")
    .eq("user_id", userId)
    .gte("created_at", weekAgo)
    .order("created_at", { ascending: false })
    .limit(5);

  if (myPosts?.length) {
    sections.push({
      title: "Tes partages récents",
      icon: "✏️",
      items: myPosts.map((p) => ({
        title: (p.content as string)?.slice(0, 80) || "Sans titre",
        description: `${p.type === "musique" ? "Musique" : p.type === "livre" ? "Livre" : "Article"} partagé`,
        source: "Ton activité",
        url: p.url as string | null,
        time: formatDigestDate(p.created_at as string),
      })),
    });
  }

  // 2. Network activity
  const { data: follows } = await supabase
    .from("follows")
    .select("following_id")
    .eq("follower_id", userId);
  const followIds = (follows ?? []).map((f) => f.following_id as string);

  if (followIds.length) {
    const { data: netPosts } = await supabase
      .from("posts")
      .select("type, content, url, created_at, profiles (name, username)")
      .in("user_id", followIds)
      .gte("created_at", weekAgo)
      .order("created_at", { ascending: false })
      .limit(6);

    if (netPosts?.length) {
      sections.push({
        title: "Dans ton réseau",
        icon: "👥",
        items: netPosts.map((p) => {
          const profile = p.profiles as { name: string | null; username: string } | null;
          return {
            title: (p.content as string)?.slice(0, 80) || "Sans titre",
            description: `Partagé par ${profile?.name ?? profile?.username ?? "quelqu'un"}`,
            source: "Ton réseau",
            url: p.url as string | null,
            time: formatDigestDate(p.created_at as string),
          };
        }),
      });
    }
  }

  // 3. Newsletter sources stubs (one item per subscribed source as recommendations)
  const subscribedSources = NEWSLETTER_SOURCES.filter((s) =>
    subscribedSourceIds.includes(s.id),
  );
  if (subscribedSources.length) {
    const grouped = new Map<string, NewsletterSource[]>();
    for (const src of subscribedSources) {
      const arr = grouped.get(src.theme) ?? [];
      arr.push(src);
      grouped.set(src.theme, arr);
    }
    for (const [theme, sources] of grouped) {
      sections.push({
        title: theme,
        icon: sources[0].icon,
        items: sources.map((s) => ({
          title: s.name,
          description: s.description,
          source: s.name,
          url: s.url,
          time: s.frequency === "quotidien" ? "Chaque jour" : s.frequency === "hebdo" ? "Chaque semaine" : "Chaque mois",
        })),
      });
    }
  }

  return sections;
}

// ── Helpers ─────────────────────────────────────────────────────────────

export function frequencyLabel(f: NewsletterSource["frequency"]): string {
  return f === "quotidien" ? "Quotidien" : f === "hebdo" ? "Hebdomadaire" : "Mensuel";
}

export function getThemes(): string[] {
  return [...new Set(NEWSLETTER_SOURCES.map((s) => s.theme))];
}

function formatDigestDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" });
}

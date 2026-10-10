import { NextResponse } from "next/server";

/**
 * GET /api/culture/feed
 *
 * Agrège du contenu culturel en temps réel depuis des APIs publiques :
 * - Wikipedia FR : article mis en avant + éphémérides ("Ce jour-là")
 * - Open Library : livres tendance du moment
 * - Liens médias culture : sélection éditoriale de sources fiables
 *
 * Le contenu change chaque jour automatiquement.
 * Cache : 30 min côté serveur pour limiter les appels.
 */

// ── Wikipedia helpers ───────────────────────────────────────────────────

interface WikiFeatured {
  tfa?: { title: string; extract: string; thumbnail?: { source: string }; content_urls?: { desktop?: { page: string } } };
  onthisday?: { text: string; year: number; pages?: { title: string; thumbnail?: { source: string }; content_urls?: { desktop?: { page: string } } }[] }[];
  mostread?: { articles: { title: string; extract?: string; thumbnail?: { source: string }; content_urls?: { desktop?: { page: string } } }[] };
}

async function fetchWikipedia(): Promise<{ featured: WikiItem | null; onThisDay: WikiItem[]; mostRead: WikiItem[] }> {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");

  try {
    const res = await fetch(
      `https://fr.wikipedia.org/api/rest_v1/feed/featured/${yyyy}/${mm}/${dd}`,
      { headers: { "User-Agent": "BoredBoard/1.0 (culture feed)" }, next: { revalidate: 1800 } }
    );
    if (!res.ok) return { featured: null, onThisDay: [], mostRead: [] };
    const data: WikiFeatured = await res.json();

    const featured: WikiItem | null = data.tfa
      ? {
          type: "wikipedia" as const,
          title: cleanTitle(data.tfa.title),
          summary: data.tfa.extract?.slice(0, 300) ?? "",
          image: data.tfa.thumbnail?.source ?? null,
          url: data.tfa.content_urls?.desktop?.page ?? `https://fr.wikipedia.org/wiki/${data.tfa.title}`,
          source: "Wikipedia",
          category: "Article du jour",
        }
      : null;

    const onThisDay: WikiItem[] = (data.onthisday ?? [])
      .slice(0, 6)
      .map((ev) => ({
        type: "ephemeride" as const,
        title: ev.text,
        summary: "",
        image: ev.pages?.[0]?.thumbnail?.source ?? null,
        url: ev.pages?.[0]?.content_urls?.desktop?.page ?? null,
        source: "Wikipedia",
        category: "Éphéméride",
        year: ev.year,
      }));

    const mostRead: WikiItem[] = (data.mostread?.articles ?? [])
      .filter((a) => !a.title.startsWith("Spécial:") && !a.title.startsWith("Wikipédia:") && a.title !== "Accueil")
      .slice(0, 8)
      .map((a) => ({
        type: "wikipedia" as const,
        title: cleanTitle(a.title),
        summary: a.extract?.slice(0, 200) ?? "",
        image: a.thumbnail?.source ?? null,
        url: a.content_urls?.desktop?.page ?? `https://fr.wikipedia.org/wiki/${a.title}`,
        source: "Wikipedia",
        category: "Tendance Wikipedia",
      }));

    return { featured, onThisDay, mostRead };
  } catch {
    return { featured: null, onThisDay: [], mostRead: [] };
  }
}

function cleanTitle(t: string): string {
  return t.replace(/_/g, " ");
}

// ── Open Library helpers ────────────────────────────────────────────────

interface OLWork {
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  key: string;
  subject?: string[];
}

interface BookItem {
  type: "book";
  title: string;
  author: string;
  year: number | null;
  cover: string | null;
  url: string;
  subjects: string[];
}

async function fetchBooks(): Promise<BookItem[]> {
  // Rotate through interesting subjects daily
  const subjects = [
    "philosophy", "french+literature", "art+history", "science+fiction",
    "poetry", "psychology", "world+history", "cinema", "music+history",
    "architecture", "mythology", "economics", "sociology", "biography",
    "astronomy", "mathematics", "theater", "photography",
  ];
  const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
  const subject = subjects[dayOfYear % subjects.length];

  try {
    const res = await fetch(
      `https://openlibrary.org/search.json?subject=${subject}&limit=8&sort=rating&language=fre`,
      { next: { revalidate: 1800 } }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.docs ?? []).slice(0, 8).map((w: OLWork) => ({
      type: "book" as const,
      title: w.title,
      author: w.author_name?.[0] ?? "Inconnu",
      year: w.first_publish_year ?? null,
      cover: w.cover_i ? `https://covers.openlibrary.org/b/id/${w.cover_i}-M.jpg` : null,
      url: `https://openlibrary.org${w.key}`,
      subjects: (w.subject ?? []).slice(0, 3),
    }));
  } catch {
    return [];
  }
}

// ── Culture media links ─────────────────────────────────────────────────

const MEDIA_LINKS = [
  { name: "France Culture", url: "https://www.radiofrance.fr/franceculture", description: "Podcasts, émissions, débats intellectuels", icon: "◎" },
  { name: "Arte", url: "https://www.arte.tv/fr/", description: "Documentaires, cinéma, séries européennes", icon: "▣" },
  { name: "Philosophie Magazine", url: "https://www.philomag.com/", description: "Réflexions, entretiens, dossiers philo", icon: "¶" },
  { name: "The Conversation FR", url: "https://theconversation.com/fr", description: "Articles de chercheurs pour le grand public", icon: "◈" },
  { name: "Gallica (BnF)", url: "https://gallica.bnf.fr/", description: "Bibliothèque numérique — livres, manuscrits, cartes", icon: "📕" },
  { name: "OpenCulture", url: "https://www.openculture.com/", description: "Cours gratuits, films, livres audio, MOOCs", icon: "✦" },
  { name: "Brain Pickings", url: "https://www.themarginalian.org/", description: "Essais sur la littérature, la science, l'art de vivre", icon: "↗" },
  { name: "Connaissance des Arts", url: "https://www.connaissancedesarts.com/", description: "Actualité art, expos, patrimoine", icon: "◉" },
];

// ── Types ────────────────────────────────────────────────────────────────

type WikiItem = {
  type: "wikipedia" | "ephemeride";
  title: string;
  summary: string;
  image: string | null;
  url: string | null;
  source: string;
  category: string;
  year?: number;
};

// ── Handler ─────────────────────────────────────────────────────────────

export async function GET() {
  const [wiki, books] = await Promise.all([fetchWikipedia(), fetchBooks()]);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return NextResponse.json(
    {
      date: dateLabel,
      featured: wiki.featured,
      onThisDay: wiki.onThisDay,
      mostRead: wiki.mostRead,
      books,
      media: MEDIA_LINKS,
    },
    {
      headers: {
        "Cache-Control": "public, max-age=900, s-maxage=1800, stale-while-revalidate=3600",
      },
    }
  );
}

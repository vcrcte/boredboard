import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { loadSharedTrack, loadShelf } from "@/lib/share-post";
import ShareButtons from "./share-buttons";

// Universal share link: opens a shared track in the receiver's own app.
// Styled with DESIGN.md (friends' shelves). No account needed.

export const dynamic = "force-dynamic";

const C = {
  ground: "#ECEEEA",
  surface: "#FAFAF8",
  ink: "#15171A",
  muted: "#5D6168",
  line: "rgba(21,23,26,0.10)",
  indigo: "#2A3560",
};
const DISPLAY = "'Cabinet Grotesk', system-ui, sans-serif";
const UI = "Satoshi, system-ui, sans-serif";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const track = await loadSharedTrack(params.id);
  if (!track) return { title: "Morceau introuvable — BoredBoard" };
  const name = track.artist ? `${track.title} — ${track.artist}` : track.title;
  const title = `${name} · partagé par ${track.sharer}`;
  const description = "Écoute-le dans ton appli : Spotify, Apple Music, Deezer, SoundCloud ou YouTube.";
  // The root layout sets its own openGraph; chat previews read these, so set them here.
  return {
    title,
    description,
    openGraph: { title, description, type: "music.song", siteName: "BoredBoard" },
    twitter: { card: "summary_large_image", title, description },
    robots: { index: false },
  };
}

export default async function SharedTrackPage({ params }: { params: { id: string } }) {
  const track = await loadSharedTrack(params.id);
  if (!track) notFound();
  const shelf = await loadShelf(track.userId);

  return (
    <div style={{ minHeight: "100vh", background: C.ground, color: C.ink, fontFamily: UI }}>
      <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800&f[]=satoshi@400,500,700&display=swap" />
      <main style={{ maxWidth: 460, margin: "0 auto", padding: "20px 16px 48px" }}>
        <Link href="/" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em", color: C.ink, textDecoration: "none" }}>
          boredboard
        </Link>

        <div style={{ marginTop: 20 }}>
          {track.cover ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={track.cover}
              alt=""
              style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 3, display: "block", boxShadow: "0 1px 2px rgba(21,23,26,.08), 0 6px 16px rgba(21,23,26,.08)" }}
            />
          ) : (
            <div style={{ width: "100%", aspectRatio: "1", borderRadius: 3, background: C.surface }} />
          )}
        </div>

        <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 32, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "20px 0 4px" }}>{track.title}</h1>
        {track.artist && <p style={{ margin: 0, fontSize: 17, color: C.muted }}>{track.artist}</p>}
        <p style={{ margin: "10px 0 20px", fontSize: 14, color: C.muted }}>partagé par {track.sharer}</p>

        <ShareButtons postId={track.id} source={track.source} matches={track.matches} pending={track.pending} />

        {shelf.length > 1 && (
          <section style={{ marginTop: 40, paddingTop: 24, borderTop: `1px solid ${C.line}` }}>
            <h2 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, letterSpacing: "-0.01em", margin: "0 0 14px" }}>L&apos;étagère de {track.sharer}</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10 }}>
              {shelf.map((item) => (
                <Link key={item.id} href={`/s/${item.id}`} title={item.title} style={{ display: "block" }}>
                  {item.cover ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.cover} alt={item.title} style={{ width: "100%", aspectRatio: "1", objectFit: "cover", borderRadius: 3, display: "block" }} />
                  ) : (
                    <span style={{ display: "flex", width: "100%", aspectRatio: "1", borderRadius: 3, background: C.surface, alignItems: "center", justifyContent: "center", fontSize: 11, color: C.muted, padding: 6, textAlign: "center" }}>
                      {item.title}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

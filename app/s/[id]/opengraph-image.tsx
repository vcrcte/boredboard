import { ImageResponse } from "next/og";
import { loadSharedTrack } from "@/lib/share-post";

// The card chat apps show when a /s/<id> link is pasted: the cover, the track
// and who shared it. Generating it also triggers matching on the first view.

export const alt = "Morceau partagé sur BoredBoard";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: { id: string } }) {
  const track = await loadSharedTrack(params.id);
  const title = track?.title ?? "BoredBoard";
  const subtitle = track?.artist ?? "";

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#ECEEEA", padding: 60, alignItems: "center", gap: 56 }}>
        {track?.cover ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={track.cover} width={510} height={510} style={{ borderRadius: 6, objectFit: "cover" }} alt="" />
        ) : (
          <div style={{ width: 510, height: 510, borderRadius: 6, background: "#FAFAF8", display: "flex" }} />
        )}
        <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
          <div style={{ fontSize: 64, fontWeight: 800, color: "#15171A", lineHeight: 1.05, letterSpacing: -2, display: "flex" }}>{title}</div>
          {subtitle && <div style={{ fontSize: 38, color: "#5D6168", marginTop: 14, display: "flex" }}>{subtitle}</div>}
          {track && <div style={{ fontSize: 30, color: "#2A3560", marginTop: 40, display: "flex" }}>partagé par {track.sharer}</div>}
          <div style={{ fontSize: 28, fontWeight: 800, color: "#15171A", marginTop: 48, display: "flex" }}>boredboard</div>
        </div>
      </div>
    ),
    { ...size },
  );
}

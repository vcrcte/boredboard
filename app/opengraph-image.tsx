import { ImageResponse } from "next/og";

// Placeholder social card, used as og:image for every page.
export const alt = "BoredBoard — Pour les esprits curieux";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "#F7F4EE",
          fontFamily: "Georgia, serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 120, letterSpacing: -3 }}>
          <span style={{ color: "#2A3560" }}>Bored</span>
          <span style={{ color: "#C4A94A" }}>Board</span>
        </div>
        <div style={{ marginTop: 24, fontSize: 36, color: "rgba(28,26,21,0.55)" }}>Pour les esprits curieux</div>
      </div>
    ),
    size,
  );
}

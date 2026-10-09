"use client";

import { useState } from "react";
import { PLATFORMS, safeHttps, type MusicEmbed } from "@/lib/music";

const TEXT = "#1C1A15";
const DIM = "rgba(28,26,21,0.4)";

function KindBadge({ embed }: { embed: MusicEmbed }) {
  if (embed.type !== "playlist" && embed.type !== "album") return null;
  return (
    <span className="ml-1 inline-block" style={{ background: "rgba(0,0,0,0.05)", color: DIM, fontSize: 9, borderRadius: 4, padding: "1px 6px" }}>
      {embed.type === "playlist" ? "Playlist" : "Album"}
    </span>
  );
}

function Cover({ src, size, radius }: { src: string | null; size: number; radius: number }) {
  const [failed, setFailed] = useState(false);
  return src && !failed ? (
    // Covers come from the platforms' CDNs, so next/image can't optimise them.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className="shrink-0 object-cover"
      style={{ width: size, height: size, borderRadius: radius }}
    />
  ) : (
    <span aria-hidden className="flex shrink-0 items-center justify-center" style={{ width: size, height: size, borderRadius: radius, background: "#EEEDFE", fontSize: size * 0.36 }}>
      ♪
    </span>
  );
}

/**
 * A shared track or album. "Écouter" opens `href` (the link that was shared)
 * when given, otherwise the platform's player page.
 */
export default function MusicCard({ embed, compact = false, href }: { embed: MusicEmbed; compact?: boolean; href?: string | null }) {
  const platform = PLATFORMS[embed.platform];
  const target = safeHttps(href) ?? safeHttps(embed.embed_url);

  if (compact) {
    return (
      <a
        href={target ?? undefined}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center transition-colors hover:bg-black/[0.02]"
        style={{ gap: 8, padding: 8, background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12 }}
      >
        <Cover src={embed.thumbnail} size={36} radius={6} />
        <span className="min-w-0 flex-1">
          <span className="block truncate" style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>{embed.title}</span>
          <span className="block truncate" style={{ fontSize: 10, color: DIM }}>
            {platform.label}
            <KindBadge embed={embed} />
          </span>
        </span>
        <span aria-hidden className="ml-auto shrink-0" style={{ fontSize: 14, color: DIM }}>▶</span>
      </a>
    );
  }

  return (
    <div className="flex items-center overflow-hidden" style={{ gap: 12, padding: 12, background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12 }}>
      <Cover src={embed.thumbnail} size={56} radius={8} />
      <div className="min-w-0 flex-1">
        <span className="mb-1 inline-block" style={{ background: platform.background, color: platform.color, fontSize: 9, borderRadius: 4, padding: "2px 6px" }}>
          {platform.label}
        </span>
        <KindBadge embed={embed} />
        <p className="line-clamp-2" style={{ fontSize: 13, fontWeight: 500, color: TEXT, lineHeight: 1.3 }}>{embed.title}</p>
      </div>
      {target && (
        <a
          href={target}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto shrink-0 transition-colors hover:bg-black/[0.04]"
          style={{ border: "1px solid rgba(0,0,0,0.1)", borderRadius: 20, fontSize: 11, padding: "5px 12px", color: TEXT }}
        >
          Écouter →
        </a>
      )}
    </div>
  );
}

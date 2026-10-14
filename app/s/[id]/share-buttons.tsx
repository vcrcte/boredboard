"use client";

import { useEffect, useState } from "react";
import { primaryService, SERVICES, type Matches, type Service } from "@/lib/music-match";

const STORAGE_KEY = "bb-service";
const NAMES: Record<Service, string> = { spotify: "Spotify", apple: "Apple Music", deezer: "Deezer", soundcloud: "SoundCloud", youtube: "YouTube" };
const INDIGO = "#2A3560";
const INK = "#15171A";
const MUTED = "#5D6168";
const LINE = "rgba(21,23,26,0.10)";

type Event = { post_id: string; event: "view" | "tap" | "join_tap"; service?: Service; match_method?: string };

/** Anonymous, aggregate event (no identifier). Fire-and-forget; never blocks the tap. */
function track(payload: Event) {
  try {
    const body = JSON.stringify(payload);
    if (navigator.sendBeacon?.(`/api/share-events`, new Blob([body], { type: "application/json" }))) return;
    void fetch("/api/share-events", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
  } catch {
    // Logging must never break the page.
  }
}

export default function ShareButtons({ postId, source, matches, pending }: { postId: string; source: Service; matches: Matches; pending: boolean }) {
  const [primary, setPrimary] = useState<Service>(source);

  useEffect(() => {
    let remembered: string | null = null;
    try {
      remembered = localStorage.getItem(STORAGE_KEY);
    } catch {
      // Private mode or blocked storage: keep the shared link's service.
    }
    setPrimary(primaryService(source, remembered, matches));
    track({ post_id: postId, event: "view" });
  }, [postId, source, matches]);

  const methodOf = (service: Service) => (pending && service !== source ? "pending" : (matches[service]?.method ?? "search-fallback"));

  const onTap = (service: Service) => {
    try {
      localStorage.setItem(STORAGE_KEY, service);
    } catch {
      // Not remembered this time.
    }
    track({ post_id: postId, event: "tap", service, match_method: methodOf(service) });
  };

  const label = (service: Service) =>
    matches[service]?.method === "search-fallback" ? `Chercher sur ${NAMES[service]}` : `Écouter sur ${NAMES[service]}`;

  const others = SERVICES.filter((service) => service !== primary && matches[service]);
  const primaryLink = matches[primary];

  return (
    <div>
      {primaryLink && (
        <a
          href={primaryLink.url}
          onClick={() => onTap(primary)}
          rel="noopener noreferrer"
          style={{ display: "block", textAlign: "center", background: INDIGO, color: "#FAFAF8", borderRadius: 6, padding: "14px 18px", fontWeight: 500, fontSize: 16, textDecoration: "none" }}
        >
          {label(primary)}
        </a>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
        {others.map((service) => (
          <a
            key={service}
            href={matches[service]!.url}
            onClick={() => onTap(service)}
            rel="noopener noreferrer"
            style={{ display: "block", textAlign: "center", border: `1px solid ${LINE}`, color: INK, borderRadius: 6, padding: "11px 10px", fontSize: 14, fontWeight: 500, textDecoration: "none" }}
          >
            {label(service)}
          </a>
        ))}
      </div>
      <a
        href={`/partager?ref=${postId}`}
        onClick={() => track({ post_id: postId, event: "join_tap" })}
        style={{ display: "block", marginTop: 22, textAlign: "center", color: INDIGO, fontWeight: 500, fontSize: 15, textDecoration: "none" }}
      >
        Partage le tien →
      </a>
      <p style={{ margin: "6px 0 0", textAlign: "center", fontSize: 12, color: MUTED }}>Copie un lien, appuie, envoie. Rien à installer.</p>
    </div>
  );
}

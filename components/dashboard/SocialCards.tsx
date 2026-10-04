"use client";

import { useContext, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import Link from "next/link";
import { getInitials } from "@/components/Navbar";
import { SocialContext } from "@/components/dashboard/SocialActions";
import { fetchRecentTracks, playedAgo, type LastfmTrack } from "@/lib/lastfm";
import { changeColor, formatPercent, formatPrice, type Quote } from "@/lib/markets";
import { avatarTones, discussions, listeningNow, readingNow } from "@/lib/sample-data";
import { supabase } from "@/lib/supabase";

const INDIGO = "#2A3560";
const TEXT = "#1C1A15";
const ink = (alpha: number) => `rgba(28,26,21,${alpha})`;
const black = (alpha: number) => `rgba(0,0,0,${alpha})`;
const DIM = ink(0.4);

const card: CSSProperties = {
  background: "#FFFFFF",
  border: `1px solid ${black(0.07)}`,
  borderRadius: 14,
  padding: 16,
};

// Tooltips, the equaliser animation and link hovers can't be inline. No quotes
// in here: React escapes them when rendering a <style> on the server.
export const socialCardsCss = `
.sc-tip { position: relative; }
.sc-tip .sc-tip-body { position: absolute; bottom: calc(100% + 8px); left: 50%; transform: translateX(-50%); white-space: nowrap; opacity: 0; pointer-events: none; transition: opacity 0.15s; z-index: 20; background: ${TEXT}; color: #F7F4EE; font-size: 11px; border-radius: 8px; padding: 6px 10px; }
.sc-tip:hover .sc-tip-body, .sc-tip:focus-within .sc-tip-body { opacity: 1; }
.sc-eq { display: flex; align-items: flex-end; gap: 1px; height: 8px; }
.sc-eq span { width: 2px; background: #534AB7; border-radius: 1px; animation: sc-eq 0.9s ease-in-out infinite; }
.sc-eq span:nth-child(2) { animation-delay: 0.2s; }
.sc-eq span:nth-child(3) { animation-delay: 0.4s; }
@keyframes sc-eq { 0%, 100% { height: 2px; } 50% { height: 8px; } }
.sc-link { color: ${INDIGO}; }
.sc-link:hover { text-decoration: underline; }
@media (prefers-reduced-motion: reduce) { .sc-eq span { animation: none; height: 6px; } }
`;

function Header({ children }: { children: ReactNode }) {
  return <p style={{ fontSize: 11, color: DIM, fontStyle: "italic" }}>{children}</p>;
}

function Circle({ initials, background, color, size = 36 }: { initials: string; background: string; color: string; size?: number }) {
  return (
    <span className="flex items-center justify-center" style={{ width: size, height: size, background, color, borderRadius: "50%", fontSize: size * 0.34, fontWeight: 500, border: "2px solid #FFFFFF" }}>
      {initials}
    </span>
  );
}

type Listener = {
  id: string;
  initials: string;
  firstName: string;
  background: string;
  color: string;
  track: LastfmTrack;
};

/**
 * The reader and the people they follow who linked a Last.fm account, with
 * their latest track. null while loading; empty when nobody has linked one
 * (or the lastfm_username column doesn't exist yet).
 */
function useNetworkListeners(): Listener[] | null {
  const { user } = useContext(SocialContext);
  const [listeners, setListeners] = useState<Listener[] | null>(null);
  const userId = user?.id;

  useEffect(() => {
    if (!userId) {
      setListeners([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: follows } = await supabase.from("follows").select("following_id").eq("follower_id", userId);
      const ids = [userId, ...(follows ?? []).map((row) => row.following_id as string)];
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("id, name, username, lastfm_username")
        .in("id", ids)
        .not("lastfm_username", "is", null);
      if (error || !profiles?.length) {
        if (!cancelled) setListeners([]);
        return;
      }

      const results = await Promise.all(
        profiles.map(async (profile, index) => {
          try {
            const [track] = await fetchRecentTracks(profile.lastfm_username, 1);
            if (!track) return null;
            const name: string = profile.name ?? profile.username;
            return {
              id: profile.id,
              initials: getInitials(profile.name, profile.username),
              firstName: name.split(/\s+/)[0],
              ...avatarTones[index % avatarTones.length],
              track,
            };
          } catch {
            return null;
          }
        }),
      );
      if (!cancelled) setListeners(results.filter((item): item is Listener => item !== null));
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return listeners;
}

function Equaliser() {
  return (
    <span aria-hidden className="sc-eq absolute" style={{ right: -2, bottom: 0, background: "#FFFFFF", borderRadius: 4, padding: "1px 2px" }}>
      <span />
      <span />
      <span />
    </span>
  );
}

export function NowListeningCard() {
  const listeners = useNetworkListeners();

  // Until someone links Last.fm, the card keeps its sample network.
  if (listeners !== null && listeners.length === 0) {
    return (
      <article className="db-card" style={card}>
        <Header>🎵 En ce moment dans ton réseau</Header>
        <ul className="mt-3 flex" style={{ gap: 10 }}>
          {listeningNow.map((person) => (
            <li key={person.initials} className="sc-tip" tabIndex={0} aria-label={`${person.name} écoute ${person.track} — ${person.artist}`}>
              <Circle initials={person.initials} background={person.background} color={person.color} />
              <Equaliser />
              <span role="tooltip" className="sc-tip-body">
                {person.name} écoute {person.track} — {person.artist}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3" style={{ fontSize: 12, color: DIM }}>
          {listeningNow.length} personnes écoutent de la musique en ce moment
        </p>
        <Link href="/settings" className="sc-link mt-1.5 inline-block" style={{ fontSize: 11 }}>
          Connecter mon Last.fm →
        </Link>
      </article>
    );
  }

  const playing = (listeners ?? []).filter((listener) => listener.track.nowPlaying).length;
  return (
    <article className="db-card" style={card}>
      <Header>🎵 En ce moment dans ton réseau</Header>
      {listeners === null ? (
        <div aria-hidden className="mt-3 flex animate-pulse" style={{ gap: 10 }}>
          {[0, 1, 2].map((index) => (
            <span key={index} style={{ width: 36, height: 36, borderRadius: "50%", background: black(0.06) }} />
          ))}
        </div>
      ) : (
        <>
          <ul className="mt-3 flex flex-wrap" style={{ gap: 10 }}>
            {listeners.map((listener) => {
              const label = listener.track.nowPlaying
                ? `${listener.firstName} écoute ${listener.track.name} — ${listener.track.artist}`
                : `${listener.firstName} a écouté ${listener.track.name} — ${listener.track.artist} · ${playedAgo(listener.track)}`;
              return (
                <li key={listener.id} className="sc-tip" tabIndex={0} aria-label={label}>
                  <Circle initials={listener.initials} background={listener.background} color={listener.color} />
                  {listener.track.nowPlaying && <Equaliser />}
                  <span role="tooltip" className="sc-tip-body">{label}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3" style={{ fontSize: 12, color: DIM }}>
            {playing === 0
              ? "Personne n'écoute de musique en ce moment."
              : `${playing} ${playing > 1 ? "personnes écoutent" : "personne écoute"} de la musique en ce moment`}
          </p>
        </>
      )}
    </article>
  );
}

export function ReadingNowCard() {
  return (
    <article className="db-card" style={card}>
      <Header>📖 Ce que lit ton réseau</Header>
      <ul className="mt-3 flex items-end" style={{ gap: 6 }}>
        {readingNow.map((book, index) => (
          <li key={book.title} className="sc-tip" tabIndex={0} aria-label={`${book.title}, lu par ${book.reader.name}`}>
            <span
              className="flex items-center justify-center"
              style={{ width: 28, height: 38, background: book.spine, borderRadius: 3, fontSize: 11, transform: `rotate(${index % 2 === 0 ? -2 : 1}deg)`, boxShadow: "0 1px 2px rgba(0,0,0,0.08)" }}
            >
              📖
            </span>
            <span role="tooltip" className="sc-tip-body">
              {book.title} · {book.reader.name}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3" style={{ fontSize: 12, color: DIM, lineHeight: 1.6 }}>
        {readingNow.slice(0, 3).map((book, index) => (
          <span key={book.title}>
            {index > 0 && " · "}
            <Link href="/profile" className="sc-link">{book.firstName}</Link> lit {book.title}
          </span>
        ))}
      </p>
    </article>
  );
}

export function DiscussionsCard() {
  return (
    <article className="db-card" style={card}>
      <Header>💬 Dans les discussions</Header>
      <ul className="mt-3 flex flex-col" style={{ gap: 12 }}>
        {discussions.map((item) => (
          <li key={item.excerpt} className="flex gap-2.5">
            <Circle initials={item.author.initials} background={item.author.background} color={item.author.color} size={28} />
            <div className="min-w-0">
              <p style={{ fontSize: 12 }}>
                <span style={{ fontWeight: 500, color: TEXT }}>{item.author.name}</span> <span style={{ color: DIM }}>a commenté</span>
              </p>
              <p className="mt-0.5" style={{ fontSize: 12, color: DIM, fontStyle: "italic", lineHeight: 1.5 }}>« {item.excerpt} »</p>
              <p className="mt-0.5 truncate" style={{ fontSize: 11, color: ink(0.55) }}>sur {item.article}</p>
            </div>
          </li>
        ))}
      </ul>
      <button type="button" className="sc-link mt-3" style={{ fontSize: 11 }}>
        Rejoindre la discussion →
      </button>
    </article>
  );
}

const FLASH_SYMBOLS = ["^FCHI", "^GSPC", "EURUSD=X", "GC=F"];

/** Four live quotes from the markets route, linking to the Bourse section. */
export function MarketsFlashCard() {
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/markets/quotes?symbols=${encodeURIComponent(FLASH_SYMBOLS.join(","))}`)
      .then(async (res) => {
        if (!res.ok) throw new Error();
        const data = await res.json();
        if (!cancelled) setQuotes(data.quotes);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <article className="db-card" style={card}>
      <div className="flex items-center justify-between">
        <Header>📈 Flash marchés</Header>
        <Link href="/actualites?rubrique=bourse" className="sc-link" style={{ fontSize: 11 }}>
          Voir la bourse →
        </Link>
      </div>
      {error ? (
        <p className="mt-3" style={{ fontSize: 12, color: DIM }}>Cotations indisponibles pour le moment.</p>
      ) : (
        <ul className="mt-3 grid grid-cols-2 sm:grid-cols-4" style={{ gap: 8, fontVariantNumeric: "tabular-nums" }}>
          {(quotes ?? FLASH_SYMBOLS.map(() => null)).map((quote, index) => (
            <li key={quote?.symbol ?? index} style={{ background: "#F7F4EE", borderRadius: 10, padding: "10px 12px" }}>
              {quote ? (
                <>
                  <p className="truncate" style={{ fontSize: 10, color: DIM }}>{quote.name}</p>
                  <p style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>{formatPrice(quote)}</p>
                  <p style={{ fontSize: 11, color: changeColor(quote.changePercent) }}>{formatPercent(quote.changePercent)}</p>
                </>
              ) : (
                <div aria-hidden className="animate-pulse" style={{ height: 46, background: black(0.04), borderRadius: 6 }} />
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}

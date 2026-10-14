"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { ensureProfile } from "@/lib/profile";
import { claimReferral, rememberReferral } from "@/lib/referral";

// One-tap sharing without installing anything: copy the track's link in your
// music app, open this page (or its Home Screen icon), tap the button. The
// track is posted to your shelf and the iPhone share sheet opens with a link
// every friend can open in their own app (/s/<post id>).
// Styled with DESIGN.md (friends' shelves).

const C = { ground: "#ECEEEA", surface: "#FAFAF8", ink: "#15171A", muted: "#5D6168", line: "rgba(21,23,26,0.10)", indigo: "#2A3560", rose: "#E0457B" };
const DISPLAY = "'Cabinet Grotesk', system-ui, sans-serif";
const UI = "Satoshi, system-ui, sans-serif";

type Result = { shareUrl: string; title: string };

export default function Partager() {
  // undefined while the session is still being read, null once known to be absent.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [manual, setManual] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [copied, setCopied] = useState(false);
  const [showManual, setShowManual] = useState(false);

  useEffect(() => {
    rememberReferral(new URLSearchParams(window.location.search).get("ref"));
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, next) => setSession(next));
    return () => subscription.unsubscribe();
  }, []);

  const send = async (shareUrl: string, title: string) => {
    // The share sheet needs a fresh tap on iOS; when it's refused here, the "Envoyer" button below retries.
    if (navigator.share) {
      try {
        await navigator.share({ url: shareUrl, text: title });
        return;
      } catch (e) {
        if (e instanceof DOMException && e.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      // Shown on screen to copy by hand.
    }
  };

  const share = async (text: string) => {
    if (!session) return;
    setError(null);
    setResult(null);
    setCopied(false);
    setBusy(true);
    try {
      const profileError = await ensureProfile(session.user);
      if (profileError) throw new Error(`Ton profil n’a pas pu être créé : ${profileError}`);
      void claimReferral(session.user.id);
      const res = await fetch("/api/share", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ url: text }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Partage impossible");
      const done = { shareUrl: data.share_url as string, title: data.title as string };
      setResult(done);
      setManual("");
      await send(done.shareUrl, done.title);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Partage impossible");
    } finally {
      setBusy(false);
    }
  };

  const pasteAndShare = async () => {
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      // Clipboard refused: fall back to the paste field.
    }
    if (!/https:\/\//.test(text)) {
      setShowManual(true);
      setError(text ? "Le presse-papiers ne contient pas de lien. Copie le lien du morceau, ou colle-le ci-dessous." : "Colle le lien du morceau ci-dessous.");
      return;
    }
    await share(text);
  };

  const primary = { display: "block", width: "100%", background: C.indigo, color: C.surface, border: "none", borderRadius: 8, padding: "18px 20px", fontSize: 17, fontWeight: 500, fontFamily: UI, cursor: "pointer", textAlign: "center" as const, textDecoration: "none" };
  const secondary = { ...primary, background: "transparent", color: C.ink, border: `1px solid ${C.line}`, padding: "14px 18px", fontSize: 15 };

  return (
    <div style={{ minHeight: "100vh", background: C.ground, color: C.ink, fontFamily: UI }}>
      <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@800&f[]=satoshi@400,500,700&display=swap" />
      <main style={{ maxWidth: 460, margin: "0 auto", padding: "20px 16px 48px" }}>
        <Link href="/dashboard" style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: "-0.02em", color: C.ink, textDecoration: "none" }}>
          boredboard
        </Link>

        <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 34, lineHeight: 1.05, letterSpacing: "-0.02em", margin: "28px 0 10px" }}>Partage un son</h1>
        <p style={{ margin: "0 0 24px", fontSize: 15, lineHeight: 1.5, color: C.muted }}>
          Copie le lien du morceau dans ton appli, puis appuie ici. Tes amis l&apos;ouvrent dans la leur : Spotify, Apple Music, Deezer, SoundCloud ou YouTube.
        </p>

        {session === undefined ? null : session === null ? (
          <div style={{ display: "grid", gap: 10 }}>
            <Link href="/login?next=/partager" style={primary}>
              Se connecter
            </Link>
            <Link href="/signup" style={secondary}>
              Créer un compte
            </Link>
          </div>
        ) : (
          <>
            <button onClick={pasteAndShare} disabled={busy} style={{ ...primary, opacity: busy ? 0.6 : 1 }}>
              {busy ? "Partage en cours…" : "Coller le lien et partager"}
            </button>

            {showManual && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void share(manual);
                }}
                style={{ display: "flex", gap: 8, marginTop: 12 }}
              >
                <input
                  value={manual}
                  onChange={(e) => setManual(e.target.value)}
                  placeholder="https://open.spotify.com/track/…"
                  inputMode="url"
                  autoFocus
                  style={{ flex: 1, minWidth: 0, border: `1px solid ${C.line}`, borderRadius: 8, padding: "12px 12px", fontSize: 16, background: C.surface, color: C.ink }}
                />
                <button type="submit" disabled={busy || !manual.trim()} style={{ ...secondary, width: "auto", padding: "12px 16px" }}>
                  OK
                </button>
              </form>
            )}

            {error && <p style={{ margin: "12px 0 0", fontSize: 14, color: C.rose }}>{error}</p>}

            {result && (
              <section style={{ marginTop: 24, padding: 16, background: C.surface, borderRadius: 8 }}>
                <p style={{ margin: 0, fontSize: 13, color: C.muted }}>Posté sur ton étagère</p>
                <p style={{ margin: "4px 0 12px", fontWeight: 700 }}>{result.title}</p>
                <button onClick={() => void send(result.shareUrl, result.title)} style={primary}>
                  Envoyer dans le groupe
                </button>
                <p style={{ margin: "10px 0 0", fontSize: 12, color: C.muted, wordBreak: "break-all" }}>
                  {copied ? "Lien copié : " : ""}
                  {result.shareUrl}
                </p>
              </section>
            )}

            <p style={{ marginTop: 32, fontSize: 13, lineHeight: 1.5, color: C.muted }}>
              Astuce : dans Safari, Partager → <strong>Sur l&apos;écran d&apos;accueil</strong>. BoredBoard devient une icône, à un tap de ton appli de musique.
            </p>
          </>
        )}
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import Navbar, { Logo } from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

const CREAM = "#F7F4EE";
const INDIGO = "#2A3560";
const TEXT = "#1C1A15";
const GEORGIA = "Georgia, 'Times New Roman', serif";
const DIM = "rgba(28,26,21,0.45)";
const GREEN = "#16A34A";
const RED = "#C0392B";
const TOKEN_KEY = "boredboard:shortcut-token";
// The shared Shortcut, signed once on a Mac: it asks for the token when installed.
const SHARED_SHORTCUT = "/BoredBoard-Music.shortcut";

type Install = {
  token: string;
  endpoint: string;
  /** The shared Shortcut on iCloud; null until it is published. */
  shortcutUrl: string | null;
  steps: { icon: string; action: string; detail: string; fields?: Record<string, string> }[];
};

// The three-second animation and the hover states can't be inline. No quotes
// in here: React escapes them when rendering a <style> on the server.
const css = `
.rc-frame { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 8px; opacity: 0; animation: rc-cycle 6s infinite; }
.rc-frame:nth-child(2) { animation-delay: 2s; }
.rc-frame:nth-child(3) { animation-delay: 4s; }
@keyframes rc-cycle { 0%, 30% { opacity: 1; } 34%, 100% { opacity: 0; } }
@media (prefers-reduced-motion: reduce) { .rc-frame { animation: none; } .rc-frame:first-child { opacity: 1; } }
`;

/** An illustration of the install, not a recording: three frames on a loop. */
function InstallAnimation() {
  const frames = [
    { icon: "📲", text: "Ajouter le raccourci" },
    { icon: "📋", text: "Coller le token" },
    { icon: "✓", text: "C'est installé" },
  ];
  return (
    <div
      aria-hidden
      className="relative mx-auto mt-5"
      style={{ width: 150, height: 210, borderRadius: 26, border: `6px solid ${TEXT}`, background: "#FFFFFF", overflow: "hidden" }}
    >
      {frames.map((frame) => (
        <div key={frame.text} className="rc-frame">
          <span
            className="flex items-center justify-center"
            style={{ width: 52, height: 52, borderRadius: 14, background: INDIGO, color: CREAM, fontSize: 24 }}
          >
            {frame.icon}
          </span>
          <span style={{ fontSize: 11, color: TEXT, fontWeight: 500 }}>{frame.text}</span>
        </div>
      ))}
    </div>
  );
}

export default function Raccourci() {
  // undefined while the session is still being read, null once known to be absent.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [install, setInstall] = useState<Install | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  // Whether this server can sign a personalised Shortcut (only when it runs on a Mac).
  const [signing, setSigning] = useState(false);
  // Read after mount: the server can't know the reader's device.
  const [device, setDevice] = useState<"ios" | "desktop" | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  // Shown only when the clipboard refused the token.
  const [visibleToken, setVisibleToken] = useState<string | null>(null);

  useEffect(() => {
    // iPadOS reports itself as a Mac: a touch screen tells them apart.
    const ios = /iPhone|iPad|iPod/i.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
    setDevice(ios ? "ios" : "desktop");
    if (!ios) {
      QRCode.toDataURL(window.location.href, { margin: 1, width: 180, color: { dark: "#1C1A15", light: "#FFFFFF" } })
        .then(setQrCode)
        .catch(() => setQrCode(null));
    }
  }, []);

  useEffect(() => {
    fetch("/api/shortcuts/download?check=1")
      .then((res) => res.json())
      .then((data) => setSigning(Boolean(data.signing)))
      .catch(() => setSigning(false));
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => subscription.unsubscribe();
  }, []);

  /**
   * Gets a fresh token, copies it, then opens the Shortcut: the shared file
   * (it asks for the token, already in the clipboard) or, on a Mac whose
   * server can sign, a personalised file with the token inside.
   */
  const handleInstall = async (target: "shared" | "personal") => {
    setError(null);
    setNotice(null);
    setVisibleToken(null);
    // The site's session lives in the browser: without this header the routes answer 401.
    if (!session) {
      setError("Connecte-toi d'abord pour installer le Raccourci.");
      return;
    }
    setBusy(true);

    const tokenRequest = fetch("/api/shortcuts/install", { headers: { Authorization: `Bearer ${session.access_token}` } }).then(
      async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.token) throw new Error(data.error ?? `Erreur ${res.status} — assure-toi d'être connecté`);
        return data as Install;
      },
    );

    // Safari only lets a click write to the clipboard if the write starts right
    // away: a ClipboardItem accepts the token while it is still being fetched.
    let copied = true;
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({ "text/plain": tokenRequest.then((result) => new Blob([result.token], { type: "text/plain" })) }),
        ]);
      } else {
        await navigator.clipboard.writeText((await tokenRequest).token);
      }
    } catch {
      copied = false;
    }

    try {
      const result = await tokenRequest;
      // Kept on this device, for the test button after a reload. Each click
      // issues a new token, which disconnects a Shortcut set up before.
      try {
        localStorage.setItem(TOKEN_KEY, result.token);
      } catch {
        // Not kept on this device: harmless.
      }
      setInstall(result);

      if (target === "personal") {
        setNotice("Téléchargement de ton Raccourci personnalisé…");
        window.location.href = `/api/shortcuts/download?token=${encodeURIComponent(result.token)}`;
      } else {
        if (!copied) setVisibleToken(result.token);
        setNotice(
          copied
            ? "Ton token est copié : colle-le quand Raccourcis le demande."
            : "Copie ton token ci-dessous : Raccourcis va te le demander.",
        );
        // Leaves time to read the message before Shortcuts takes over.
        setTimeout(() => {
          window.location.href = SHARED_SHORTCUT;
        }, copied ? 600 : 4000);
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Erreur — assure-toi d'être connecté");
    }
    setBusy(false);
  };

  const runTest = async () => {
    if (!install) return;
    setTest(null);
    const res = await fetch("/api/shortcuts/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: install.token, title: "Test du Raccourci BoredBoard", artist: "BoredBoard", platform: "apple" }),
    });
    const data = await res.json().catch(() => ({}));
    setTest(res.ok ? { ok: true, message: "✓ Ça marche : un post test est dans ton feed." } : { ok: false, message: data.error ?? "La connexion a échoué." });
  };

  const card = { background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, padding: 24 };

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <style>{css}</style>
      <Navbar />
      <main className="mx-auto" style={{ maxWidth: 560, padding: "48px 20px" }}>
        <Logo className="text-[24px]" />
        <h1 className="mt-4" style={{ fontFamily: GEORGIA, fontSize: 28, fontWeight: 400, color: TEXT, lineHeight: 1.2 }}>
          Partage ta musique en un clic
        </h1>
        <p className="mt-2" style={{ fontSize: 14, color: DIM, lineHeight: 1.6 }}>
          Installe le Raccourci Apple pour partager ce que tu écoutes directement depuis ton iPhone ou Mac.
        </p>

        {/* Step 1 */}
        <section className="mt-8 text-center" style={card}>
          <p style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: DIM }}>Étape 1</p>
          <h2 className="mt-1" style={{ fontSize: 17, fontWeight: 500 }}>Installe le Raccourci</h2>

          {session === null ? (
            <p className="mt-4" style={{ fontSize: 13 }}>
              <Link href="/login" style={{ color: INDIGO, textDecoration: "underline" }}>Connecte-toi</Link> pour installer le Raccourci.
            </p>
          ) : device === "desktop" ? (
            <>
              <p className="mt-4" style={{ fontSize: 15, fontWeight: 500 }}>📲 Ouvre cette page sur ton iPhone pour installer le Raccourci</p>
              {qrCode && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={qrCode} alt="QR code de cette page" width={180} height={180} className="mx-auto mt-4" style={{ borderRadius: 12, border: "1px solid rgba(0,0,0,0.07)" }} />
              )}
              <p className="mt-2" style={{ fontSize: 12, color: DIM }}>Scanne-le avec l&apos;appareil photo de ton iPhone.</p>
              <button
                type="button"
                onClick={() => handleInstall(signing ? "personal" : "shared")}
                disabled={busy}
                className="mt-5 hover:bg-black/[0.04] disabled:opacity-50"
                style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 20, padding: "9px 20px", fontSize: 13, color: TEXT }}
              >
                {busy ? "Préparation…" : "💻 Installer sur ce Mac"}
              </button>
              {signing && (
                <p className="mt-2" style={{ fontSize: 12, color: DIM }}>Le raccourci sera configuré automatiquement avec ton compte</p>
              )}
            </>
          ) : (
            <button
              type="button"
              onClick={() => handleInstall("shared")}
              disabled={!session || busy || device === null}
              className="mt-5 transition hover:brightness-125 disabled:opacity-50"
              style={{ background: INDIGO, color: CREAM, borderRadius: 24, padding: "14px 28px", fontWeight: 500, fontSize: 15 }}
            >
              {busy ? "Préparation…" : "📲 Installer le Raccourci"}
            </button>
          )}
          {visibleToken && (
            <input
              readOnly
              value={visibleToken}
              aria-label="Ton token"
              onFocus={(event) => event.currentTarget.select()}
              className="mt-3 w-full"
              style={{ background: "#F0EBE1", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, padding: "8px 12px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, outline: "none" }}
            />
          )}
          {error && <p role="alert" className="mt-3" style={{ fontSize: 12, color: RED }}>{error}</p>}
          {notice && !error && <p role="status" className="mt-3" style={{ fontSize: 12, color: GREEN }}>{notice}</p>}

          <InstallAnimation />
          <p className="mt-2" style={{ fontSize: 10, color: DIM }}>Illustration</p>
          <p className="mt-3" style={{ fontSize: 12, color: DIM, lineHeight: 1.6 }}>
            Fonctionne avec l&apos;app Musique (Apple Music). Raccourcis ne peut pas lire ce que jouent Spotify ou Deezer.
          </p>
        </section>

        {/* Step 2 */}
        <section className="mt-4 text-center" style={{ ...card, opacity: install ? 1 : 0.5 }}>
          <p style={{ fontSize: 11, letterSpacing: "0.1em", textTransform: "uppercase", color: DIM }}>Étape 2</p>
          <h2 className="mt-1" style={{ fontSize: 17, fontWeight: 500 }}>C&apos;est tout !</h2>
          <p className="mt-2" style={{ fontSize: 13, color: DIM, lineHeight: 1.6 }}>
            Le Raccourci est installé. La prochaine fois que tu écoutes un titre, ouvre le Raccourci et il sera partagé automatiquement sur BoredBoard.
          </p>
          {install && (
            <>
              <button type="button" onClick={runTest} className="mt-3 hover:underline" style={{ fontSize: 12, color: INDIGO }}>
                Tester maintenant
              </button>
              {test && (
                <p role={test.ok ? "status" : "alert"} className="mt-2" style={{ fontSize: 12, color: test.ok ? GREEN : RED }}>
                  {test.message}
                </p>
              )}
            </>
          )}
        </section>

        <p className="mt-6 text-center" style={{ fontSize: 12, color: DIM }}>
          Si tu n&apos;as pas encore de compte BoredBoard, <Link href="/signup" style={{ color: INDIGO }}>crée-en un gratuitement</Link> puis reviens ici.
        </p>
      </main>
    </div>
  );
}

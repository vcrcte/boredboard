"use client";

import { useEffect, useState } from "react";
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
.rc-copy:hover { background: rgba(0,0,0,0.04); }
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

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(value).catch(() => undefined);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }}
      className="rc-copy shrink-0"
      style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, fontSize: 11, padding: "3px 10px", color: copied ? GREEN : TEXT }}
    >
      {copied ? "✓ Copié" : label}
    </button>
  );
}

export default function Raccourci() {
  // undefined while the session is still being read, null once known to be absent.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [install, setInstall] = useState<Install | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [test, setTest] = useState<{ ok: boolean; message: string } | null>(null);
  // Whether this server can sign a personalised Shortcut (only when it runs on a Mac).
  const [signing, setSigning] = useState(false);

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

  const start = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/shortcuts/install", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? `Erreur ${res.status}`);
      const result = data as Install;
      // Kept on this device, for the test button after a reload. Each click
      // issues a new token, which disconnects a Shortcut set up before.
      try {
        localStorage.setItem(TOKEN_KEY, result.token);
      } catch {
        // Not kept on this device: harmless.
      }
      // Copied now, while the click still counts as a user gesture: the
      // Shortcut asks for it once, at install.
      await navigator.clipboard.writeText(result.token).catch(() => undefined);
      setInstall(result);
      if (signing) {
        // The file comes with the token inside: on iPhone, iOS offers to open it in Shortcuts.
        window.location.href = `/api/shortcuts/download?token=${encodeURIComponent(result.token)}`;
      } else if (result.shortcutUrl) {
        window.open(result.shortcutUrl, "_blank", "noopener,noreferrer");
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Installation impossible.");
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
          ) : (
            <button
              type="button"
              onClick={start}
              disabled={!session || busy}
              className="mt-5 transition hover:brightness-125 disabled:opacity-50"
              style={{ background: INDIGO, color: CREAM, borderRadius: 24, padding: "14px 28px", fontWeight: 500, fontSize: 15 }}
            >
              {busy ? "Préparation…" : signing ? "📲 Télécharger mon Raccourci personnalisé" : "📲 Installer en 1 tap"}
            </button>
          )}
          {signing && session && (
            <p className="mt-2" style={{ fontSize: 12, color: DIM }}>Le raccourci sera configuré automatiquement avec ton compte</p>
          )}
          {error && <p role="alert" className="mt-3" style={{ fontSize: 12, color: RED }}>{error}</p>}

          <InstallAnimation />
          <p className="mt-2" style={{ fontSize: 10, color: DIM }}>Illustration</p>
          <p className="mt-3" style={{ fontSize: 12, color: DIM, lineHeight: 1.6 }}>
            Fonctionne avec Apple Music. Avec Spotify ou Deezer, le Raccourci te demande le titre.
          </p>
        </section>

        {/* Until the shared Shortcut is published: build it in four guided steps. */}
        {install && !install.shortcutUrl && !signing && (
          <section className="mt-4" style={card}>
            <h2 style={{ fontSize: 15, fontWeight: 500 }}>Crée-le en 1 minute</h2>
            <p className="mt-1" style={{ fontSize: 12, color: DIM, lineHeight: 1.6 }}>
              Le Raccourci prêt à installer arrive bientôt. En attendant, ouvre l&apos;app Raccourcis, touche « + », puis ajoute ces actions dans l&apos;ordre.
              Ton token est déjà copié.
            </p>
            <ol className="mt-4 flex flex-col" style={{ gap: 10 }}>
              {install.steps.map((step, index) => (
                <li key={step.action} style={{ background: CREAM, borderRadius: 12, padding: 14 }}>
                  <p className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 500 }}>
                    <span aria-hidden style={{ fontSize: 18 }}>{step.icon}</span>
                    {index + 1}. {step.action}
                  </p>
                  <p className="mt-1" style={{ fontSize: 12, color: DIM }}>{step.detail}</p>
                  {step.fields && (
                    <dl className="mt-3 flex flex-col" style={{ gap: 6 }}>
                      {Object.entries(step.fields).map(([name, value]) => {
                        const copyable = name === "URL" || name === "token";
                        return (
                          <div key={name} className="flex items-center gap-2" style={{ fontSize: 12 }}>
                            <dt className="shrink-0" style={{ width: 120, color: DIM }}>{name}</dt>
                            <dd className="min-w-0 flex-1 truncate" style={{ fontFamily: copyable ? "ui-monospace, Menlo, monospace" : undefined, fontSize: copyable ? 11 : 12 }}>
                              {name === "token" ? "•••••••• (déjà copié)" : value}
                            </dd>
                            {copyable && <CopyButton value={value} label="Copier" />}
                          </div>
                        );
                      })}
                    </dl>
                  )}
                </li>
              ))}
            </ol>
          </section>
        )}

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

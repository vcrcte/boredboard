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
// The shared Shortcut: it contains a BOREDBOARD_TOKEN placeholder that each
// user replaces with their own token after installing it.
const SHORTCUT_ICLOUD_URL = "https://www.icloud.com/shortcuts/95743782176c478485d046eb866a95e2";

type Status = { ok: boolean; message: string } | null;

export default function Raccourci() {
  // undefined while the session is still being read, null once known to be absent.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [token, setToken] = useState("");
  const [tokenStatus, setTokenStatus] = useState<Status>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [test, setTest] = useState<Status>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => subscription.unsubscribe();
  }, []);

  const showToken = async () => {
    setTokenStatus(null);
    setCopied(false);
    // The site's session lives in the browser: without this header the route answers 401.
    if (!session) {
      setTokenStatus({ ok: false, message: "Connecte-toi d'abord pour obtenir ton token." });
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/shortcuts/token", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) throw new Error(data.error ?? `Erreur ${res.status}`);
      setToken(data.token);
      try {
        localStorage.setItem(TOKEN_KEY, data.token);
      } catch {
        // Not kept on this device: harmless.
      }
    } catch (caught) {
      setTokenStatus({ ok: false, message: caught instanceof Error ? caught.message : "Impossible d'obtenir le token." });
    }
    setGenerating(false);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setTokenStatus({ ok: false, message: "Copie impossible : sélectionne le token et copie-le à la main." });
    }
  };

  const runTest = async () => {
    setTest(null);
    const res = await fetch("/api/shortcuts/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, title: "Test du Raccourci BoredBoard", artist: "BoredBoard", platform: "apple" }),
    });
    const data = await res.json().catch(() => ({}));
    setTest(res.ok ? { ok: true, message: "✓ Ça marche : un post test est dans ton feed." } : { ok: false, message: data.error ?? "La connexion a échoué." });
  };

  const card = { background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 14, padding: 24 };

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <Navbar />
      <main className="mx-auto" style={{ maxWidth: 560, padding: "48px 20px" }}>
        <Logo className="text-[24px]" />
        <h1 className="mt-4" style={{ fontFamily: GEORGIA, fontSize: 28, fontWeight: 400, color: TEXT, lineHeight: 1.2 }}>
          Partage ta musique en un clic
        </h1>
        <p className="mt-2" style={{ fontSize: 14, color: DIM, lineHeight: 1.6 }}>
          Installe le Raccourci Apple pour partager ce que tu écoutes directement depuis ton iPhone ou Mac.
        </p>

        <section className="mt-8 text-center" style={card}>
          <a
            href={SHORTCUT_ICLOUD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="transition hover:brightness-125"
            style={{
              display: "inline-block",
              background: INDIGO,
              color: CREAM,
              borderRadius: 20,
              padding: "12px 28px",
              fontSize: 14,
              fontWeight: 500,
              textDecoration: "none",
              textAlign: "center",
            }}
          >
            📲 Installer le Raccourci BoredBoard
          </a>
          <p className="mt-2" style={{ fontSize: 11, color: DIM }}>Compatible iPhone et iPad · Apple Music</p>

          <div className="my-6" style={{ height: 1, background: "rgba(0,0,0,0.07)" }} />

          <div className="text-left">
            <h2 style={{ fontSize: 15, fontWeight: 500 }}>Ton token personnel</h2>
            <p className="mt-1" style={{ fontSize: 12, color: DIM, lineHeight: 1.6 }}>
              Il identifie ton compte BoredBoard : ne le partage avec personne. En afficher un nouveau désactive le précédent.
            </p>

            {session === null ? (
              <p className="mt-3" style={{ fontSize: 13 }}>
                <Link href="/login" style={{ color: INDIGO, textDecoration: "underline" }}>Connecte-toi</Link> pour obtenir ton token.
              </p>
            ) : token ? (
              <>
                <input
                  readOnly
                  value={token}
                  aria-label="Ton token personnel"
                  onFocus={(event) => event.currentTarget.select()}
                  className="mt-3 w-full"
                  style={{ background: "#F0EBE1", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, padding: "8px 12px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: TEXT, outline: "none" }}
                />
                <div className="mt-2 flex items-center gap-3">
                  <button type="button" onClick={copy} className="hover:bg-black/[0.04]" style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, fontSize: 12, padding: "5px 14px" }}>
                    Copier
                  </button>
                  {copied && <span style={{ fontSize: 11, color: GREEN }}>✓ Copié !</span>}
                </div>
              </>
            ) : (
              <button
                type="button"
                onClick={showToken}
                disabled={!session || generating}
                className="mt-3 hover:bg-black/[0.04] disabled:opacity-50"
                style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, fontSize: 13, padding: "7px 16px", color: TEXT }}
              >
                {generating ? "Génération…" : "Afficher mon token"}
              </button>
            )}
            {tokenStatus && (
              <p role="alert" className="mt-2" style={{ fontSize: 12, color: tokenStatus.ok ? GREEN : RED }}>{tokenStatus.message}</p>
            )}

            <p className="mt-4" style={{ fontSize: 13, color: TEXT, lineHeight: 1.6 }}>
              Après l&apos;installation, ouvre le Raccourci et remplace <code style={{ fontSize: 12 }}>BOREDBOARD_TOKEN</code> par ton token ci-dessus.
            </p>
          </div>
        </section>

        <section className="mt-4 text-center" style={{ ...card, opacity: token ? 1 : 0.5 }}>
          <h2 style={{ fontSize: 17, fontWeight: 500 }}>C&apos;est tout !</h2>
          <p className="mt-2" style={{ fontSize: 13, color: DIM, lineHeight: 1.6 }}>
            La prochaine fois que tu écoutes un titre, ouvre le Raccourci et il sera partagé automatiquement sur BoredBoard.
          </p>
          {token && (
            <>
              <button type="button" onClick={runTest} className="mt-3 hover:underline" style={{ fontSize: 12, color: INDIGO }}>
                Tester mon token
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

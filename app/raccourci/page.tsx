"use client";

import { useEffect, useState, type ReactNode } from "react";
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
// Placeholder until the shared Shortcut exists on iCloud.
const SHORTCUT_URL = "https://www.icloud.com/shortcuts/";

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <section className="mb-4" style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 12, padding: 20 }}>
      <h2 className="mb-3 flex items-center gap-2.5" style={{ fontSize: 15, fontWeight: 500, color: TEXT }}>
        <span className="flex shrink-0 items-center justify-center" style={{ width: 24, height: 24, borderRadius: "50%", background: INDIGO, color: CREAM, fontSize: 12 }}>
          {number}
        </span>
        {title}
      </h2>
      {children}
    </section>
  );
}

type Status = { ok: boolean; message: string } | null;

export default function Raccourci() {
  // undefined while the session is still being read, null once known to be absent.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [token, setToken] = useState("");
  const [tokenStatus, setTokenStatus] = useState<Status>(null);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [testStatus, setTestStatus] = useState<Status>(null);
  const [testing, setTesting] = useState(false);
  // Read after mount: the server doesn't know which address the page is served from.
  const [origin, setOrigin] = useState("");

  useEffect(() => setOrigin(window.location.origin), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => subscription.unsubscribe();
  }, []);

  const generate = async () => {
    if (!session) return;
    setGenerating(true);
    setTokenStatus(null);
    setCopied(false);
    const res = await fetch("/api/shortcuts/token", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } });
    const data = await res.json().catch(() => ({}));
    if (res.ok) setToken(data.token);
    else setTokenStatus({ ok: false, message: data.error ?? "Impossible de générer le token." });
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

  const test = async () => {
    setTesting(true);
    setTestStatus(null);
    const res = await fetch("/api/shortcuts/music", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, title: "Test du Raccourci BoredBoard", artist: "BoredBoard", platform: "apple" }),
    });
    const data = await res.json().catch(() => ({}));
    setTestStatus(
      res.ok
        ? { ok: true, message: "✓ Connexion réussie ! Un post test a été créé dans ton feed." }
        : { ok: false, message: data.error ?? "La connexion a échoué." },
    );
    setTesting(false);
  };

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

        <div className="mt-8">
          <Step number={1} title="Copie ton token personnel">
            <p className="mb-3" style={{ fontSize: 13, color: DIM, lineHeight: 1.6 }}>
              Ce token identifie ton compte BoredBoard. Ne le partage avec personne.
            </p>
            {session === null ? (
              <p style={{ fontSize: 13, color: TEXT }}>
                <Link href="/login" style={{ color: INDIGO, textDecoration: "underline" }}>Connecte-toi</Link> pour obtenir ton token.
              </p>
            ) : token ? (
              <>
                <input
                  readOnly
                  value={token}
                  aria-label="Ton token personnel"
                  onFocus={(event) => event.currentTarget.select()}
                  className="w-full"
                  style={{ background: "#F0EBE1", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 8, padding: "8px 12px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 12, color: TEXT, outline: "none" }}
                />
                <div className="mt-2 flex items-center gap-3">
                  <button type="button" onClick={copy} className="hover:bg-black/[0.04]" style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, fontSize: 12, padding: "5px 14px" }}>
                    Copier
                  </button>
                  {copied && <span style={{ fontSize: 11, color: GREEN }}>✓ Copié !</span>}
                </div>
                <p className="mt-2" style={{ fontSize: 11, color: DIM }}>
                  Il ne sera plus affiché : garde-le dans ton Raccourci. En générer un autre désactive celui-ci.
                </p>
              </>
            ) : (
              <button
                type="button"
                onClick={generate}
                disabled={!session || generating}
                className="hover:bg-black/[0.04] disabled:opacity-50"
                style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, fontSize: 13, padding: "7px 16px", color: TEXT }}
              >
                {generating ? "Génération…" : "Afficher mon token"}
              </button>
            )}
            {tokenStatus && (
              <p role="alert" className="mt-2" style={{ fontSize: 12, color: tokenStatus.ok ? GREEN : RED }}>{tokenStatus.message}</p>
            )}
          </Step>

          <Step number={2} title="Installe le Raccourci">
            <p className="mb-4" style={{ fontSize: 13, color: DIM, lineHeight: 1.6 }}>
              Clique le bouton ci-dessous pour installer le Raccourci Apple sur ton appareil.
            </p>
            <a
              href={SHORTCUT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block transition hover:brightness-125"
              style={{ background: INDIGO, color: CREAM, borderRadius: 20, padding: "12px 24px", fontWeight: 500, fontSize: 13 }}
            >
              📲 Installer le Raccourci
            </a>
            <p className="mt-2" style={{ fontSize: 11, color: DIM, fontStyle: "italic" }}>
              Compatible iPhone, iPad et Mac avec macOS Monterey ou plus récent.
            </p>
            <details className="mt-3">
              <summary className="cursor-pointer" style={{ fontSize: 12, color: INDIGO }}>Ou crée-le toi-même dans l&apos;app Raccourcis</summary>
              <ol className="mt-2 list-decimal pl-5" style={{ fontSize: 12, color: TEXT, lineHeight: 1.7 }}>
                <li>Action « Texte » : colle ton token.</li>
                <li>Action « Obtenir le morceau en cours » (app Musique).</li>
                <li>
                  Action « Obtenir le contenu de l&apos;URL » : <code>POST</code> sur{" "}
                  <code>{origin}/api/shortcuts/music</code>, corps JSON avec{" "}
                  <code>token</code>, <code>title</code> (Nom du morceau), <code>artist</code> (Artiste) et <code>platform</code> = <code>apple</code>.
                </li>
                <li>Action « Afficher la notification » avec le champ <code>message</code> de la réponse.</li>
              </ol>
              <p className="mt-2" style={{ fontSize: 11, color: DIM }}>
                Détail des étapes : <a href="/boredboard-shortcut.json" target="_blank" style={{ color: INDIGO }}>boredboard-shortcut.json</a>
              </p>
            </details>
          </Step>

          <Step number={3} title="Configure le Raccourci">
            <ol className="list-decimal pl-5" style={{ fontSize: 13, color: TEXT, lineHeight: 1.7 }}>
              <li>Ouvre le Raccourci installé</li>
              <li>Colle ton token dans le champ « Token BoredBoard »</li>
              <li>Ajoute le Raccourci à ta barre de menu (Mac) ou écran d&apos;accueil (iPhone)</li>
              <li>Lance un titre sur Spotify ou Apple Music et active le Raccourci</li>
            </ol>
            <p className="mt-2" style={{ fontSize: 11, color: DIM, lineHeight: 1.5 }}>
              Sur iPhone, l&apos;app Raccourcis ne lit que ce que joue l&apos;app Musique : pour Spotify, le titre est à saisir.
            </p>

            <div className="mt-4" style={{ borderTop: "1px solid rgba(0,0,0,0.06)", paddingTop: 14 }}>
              <button
                type="button"
                onClick={test}
                disabled={!token || testing}
                className="hover:bg-black/[0.04] disabled:opacity-50"
                style={{ border: "1px solid rgba(0,0,0,0.12)", borderRadius: 8, fontSize: 13, padding: "7px 16px", color: TEXT }}
              >
                {testing ? "Test…" : "Tester la connexion"}
              </button>
              {!token && <p className="mt-2" style={{ fontSize: 11, color: DIM }}>Affiche d&apos;abord ton token (étape 1).</p>}
              {testStatus && (
                <p role={testStatus.ok ? "status" : "alert"} className="mt-2" style={{ fontSize: 12, color: testStatus.ok ? GREEN : RED }}>
                  {testStatus.message}
                </p>
              )}
            </div>
          </Step>
        </div>

        <p className="mt-6 text-center" style={{ fontSize: 12, color: DIM }}>
          Si tu n&apos;as pas encore de compte BoredBoard, <Link href="/signup" style={{ color: INDIGO }}>crée-en un gratuitement</Link> puis reviens ici.
        </p>
      </main>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Session } from "@supabase/supabase-js";
import Navbar, { Logo } from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

const CREAM = "#F7F4EE";
const BEIGE = "#F0EBE1";
const INDIGO = "#2A3560";
const GOLD = "#C4A94A";
const TEXT = "#1C1A15";
const GEORGIA = "Georgia, 'Times New Roman', serif";
const DIM = "rgba(28,26,21,0.45)";
const GREEN = "#16A34A";
const RED = "#C0392B";
const SHORTCUT_ICLOUD_URL = "https://www.icloud.com/shortcuts/3025a45a81ac4b83951d76aca9ffa814";
// Second Shortcut, from the share sheet: it sends the shared link to the same route.
const SHORTCUT_SHARE_URL = "https://www.icloud.com/shortcuts/b217b911bcc14177b3347b4b40f794dc";

const sharePlatforms = [
  { label: "Spotify", background: "rgba(30,215,96,0.08)", color: "#1DB954" },
  { label: "Deezer", background: "rgba(239,100,0,0.08)", color: "#EF6400" },
  { label: "YouTube", background: "rgba(255,0,0,0.08)", color: "#FF0000" },
  { label: "Apple Music", background: "rgba(252,60,68,0.08)", color: "#FC3C44" },
];

const card = { background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.07)", borderRadius: 16, padding: 24 };
const desc = { fontSize: 13, color: DIM, lineHeight: 1.6 };

const steps = [
  "Ouvre l'app Raccourcis sur ton iPhone",
  "Appuie longuement sur BoredBoard Music → Modifier",
  "Dans le champ token, supprime le texte existant",
  "Colle ton token personnel",
  "C'est terminé !",
];

const faq = [
  {
    question: "Ça marche avec Spotify ?",
    answer:
      "Pas encore — on y travaille. Pour l'instant, le raccourci fonctionne avec Apple Music. Tu peux aussi partager un lien Spotify depuis le dashboard.",
  },
  {
    question: "C'est quoi le token ?",
    answer:
      "Un identifiant unique lié à ton compte BoredBoard. Il permet au raccourci de publier dans ton feed. Ne le partage avec personne.",
  },
  {
    question: "Ça marche sur Mac ?",
    answer:
      "Le raccourci fonctionne uniquement sur iPhone pour l'instant. Sur Mac, tu peux partager ta musique en collant un lien depuis le dashboard.",
  },
];

// Hover rules: no quotes inside, React would escape them and break hydration.
const css = `
.rc-ghost:hover { background: rgba(0,0,0,0.04); }
.rc-main:hover { filter: brightness(1.15); }
.rc-copy:hover { filter: brightness(1.06); }
.rc-dark:hover { filter: brightness(1.6); }
`;

function StepBadge({ children, color = GOLD }: { children: string; color?: string }) {
  return (
    <p className="mb-3" style={{ fontSize: 9, color, letterSpacing: "0.12em", textTransform: "uppercase" }}>
      {children}
    </p>
  );
}

function FaqItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: "1px solid rgba(0,0,0,0.06)", padding: "12px 0" }}>
      <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} className="flex w-full items-center text-left" style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>
        {question}
        <span aria-hidden className="ml-auto" style={{ color: DIM, transition: "transform 0.15s", transform: open ? "rotate(90deg)" : "none" }}>
          ▸
        </span>
      </button>
      {open && <p className="mt-2" style={{ fontSize: 12, color: "rgba(28,26,21,0.5)", lineHeight: 1.6 }}>{answer}</p>}
    </div>
  );
}

export default function Raccourci() {
  // undefined while the session is still being read, null once known to be absent.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [tokenVisible, setTokenVisible] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => setSession(newSession));
    return () => subscription.unsubscribe();
  }, []);

  const showToken = async () => {
    if (!session) return;
    setError(null);
    setLoading(true);
    try {
      // The site's session lives in the browser: without this header the route answers 401.
      const res = await fetch("/api/shortcuts/token", { headers: { Authorization: `Bearer ${session.access_token}` } });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.token) throw new Error(data.error ?? `Erreur ${res.status}`);
      setToken(data.token);
      setTokenVisible(true);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Impossible d'obtenir ton token.");
    }
    setLoading(false);
  };

  const copy = async () => {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setCopied(true);
    } catch {
      setError("Copie impossible : sélectionne le token et copie-le à la main.");
    }
  };

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <style>{css}</style>
      <Navbar />
      <main className="mx-auto" style={{ maxWidth: 520, padding: "48px 20px" }}>
        <div className="mb-2">
          <Logo className="text-[20px]" />
        </div>
        <h1 style={{ fontFamily: GEORGIA, fontSize: 28, fontWeight: 400, color: TEXT, lineHeight: 1.2 }}>Partage ta musique en 1 tap</h1>
        <p className="mt-2" style={{ fontSize: 14, color: DIM, lineHeight: 1.6 }}>
          Écoute un titre sur Apple Music → active le Raccourci → il apparaît dans ton feed BoredBoard.
        </p>
        <div className="mt-3 flex flex-wrap" style={{ gap: 8 }}>
          <span style={{ background: "rgba(252,60,68,0.08)", color: "#FC3C44", fontSize: 11, padding: "4px 10px", borderRadius: 8 }}>Apple Music</span>
          <span style={{ background: "rgba(0,0,0,0.04)", color: "rgba(28,26,21,0.3)", fontSize: 11, padding: "4px 10px", borderRadius: 8 }}>Bientôt Spotify</span>
        </div>

        {session === null ? (
          <section className="mt-8 text-center" style={card}>
            <p style={{ fontSize: 16, fontWeight: 500 }}>Connecte-toi d&apos;abord</p>
            <p className="mt-2" style={desc}>Le Raccourci publie dans ton feed : il a besoin de ton compte BoredBoard.</p>
            <Link
              href="/login"
              className="rc-main mt-4 inline-block"
              style={{ background: INDIGO, color: CREAM, borderRadius: 14, padding: "12px 28px", fontSize: 14, fontWeight: 500, textDecoration: "none" }}
            >
              Se connecter
            </Link>
          </section>
        ) : (
          <>
            {/* Step 1 */}
            <section className="mt-8" style={card}>
              <StepBadge>Étape 1</StepBadge>
              <h2 style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>Installe le Raccourci</h2>
              <p className="mb-4 mt-2" style={desc}>Clique le bouton ci-dessous depuis ton iPhone. Le raccourci s&apos;installe automatiquement.</p>
              <a
                href={SHORTCUT_ICLOUD_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rc-main"
                style={{ display: "block", background: INDIGO, color: CREAM, borderRadius: 14, padding: "14px 28px", fontSize: 15, fontWeight: 500, textAlign: "center", textDecoration: "none" }}
              >
                ↓ Installer le Raccourci
              </a>
              <p className="mt-2 text-center" style={{ fontSize: 11, color: DIM, fontStyle: "italic" }}>Ouvre ce lien sur ton iPhone</p>
            </section>

            {/* Share sheet Shortcut */}
            <section className="mt-4" style={card}>
              <span className="mb-3 inline-block" style={{ fontSize: 9, background: "rgba(22,163,74,0.08)", color: GREEN, padding: "3px 8px", borderRadius: 4, letterSpacing: "0.12em" }}>
                NOUVEAU
              </span>
              <h2 style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>Partage depuis Spotify, Deezer ou YouTube</h2>
              <p className="mb-4 mt-2" style={desc}>Appuie sur Partager dans ton app → choisis BoredBoard Share → c&apos;est posté.</p>
              <a
                href={SHORTCUT_SHARE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rc-dark"
                style={{ display: "block", background: TEXT, color: CREAM, borderRadius: 14, padding: "14px 28px", fontSize: 15, fontWeight: 500, textAlign: "center", textDecoration: "none" }}
              >
                ↗ Installer le Raccourci Partage
              </a>
              <div className="mt-3 flex flex-wrap justify-center" style={{ gap: 6 }}>
                {sharePlatforms.map((item) => (
                  <span key={item.label} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 6, background: item.background, color: item.color }}>
                    {item.label}
                  </span>
                ))}
              </div>
            </section>

            {/* Step 2 */}
            <section className="mt-4" style={card}>
              <StepBadge>Étape 2</StepBadge>
              <h2 style={{ fontSize: 16, fontWeight: 500, color: TEXT }}>Configure ton token</h2>
              <p className="mb-4 mt-2" style={desc}>Copie ton token personnel et colle-le dans le raccourci à la place du texte existant.</p>

              <div style={{ background: CREAM, borderRadius: 12, padding: 16 }}>
                {!tokenVisible ? (
                  <button
                    type="button"
                    onClick={showToken}
                    disabled={!session || loading}
                    className="rc-ghost w-full disabled:opacity-50"
                    style={{ border: "1px solid rgba(0,0,0,0.08)", borderRadius: 10, padding: "10px 13px", fontSize: 13, color: TEXT }}
                  >
                    {loading ? "Génération…" : "Afficher mon token"}
                  </button>
                ) : (
                  <>
                    <div className="flex" style={{ gap: 8 }}>
                      <input
                        readOnly
                        value={token ?? ""}
                        aria-label="Ton token personnel"
                        onFocus={(event) => event.currentTarget.select()}
                        className="min-w-0 flex-1"
                        style={{ background: "#FFFFFF", border: "1px solid rgba(0,0,0,0.08)", borderRadius: 8, padding: "10px 14px", fontFamily: "ui-monospace, Menlo, monospace", fontSize: 13, color: TEXT, outline: "none" }}
                      />
                      <button
                        type="button"
                        onClick={copy}
                        className="rc-copy shrink-0"
                        style={{ background: GOLD, color: TEXT, borderRadius: 10, padding: "10px 16px", fontWeight: 500, fontSize: 13 }}
                      >
                        Copier
                      </button>
                    </div>
                    {copied && <p className="mt-2" style={{ fontSize: 11, color: GREEN }}>✓ Copié !</p>}
                  </>
                )}
                {error && <p role="alert" className="mt-2" style={{ fontSize: 11, color: RED }}>{error}</p>}
              </div>

              <ol className="mt-4" style={{ fontSize: 12, color: "rgba(28,26,21,0.5)", lineHeight: 1.7 }}>
                {steps.map((step, index) => (
                  <li key={step}>
                    {index + 1}. {step}
                  </li>
                ))}
              </ol>
            </section>

            {/* Step 3 */}
            <section className="mt-4" style={{ background: BEIGE, border: "1px solid rgba(196,169,74,0.15)", borderRadius: 16, padding: 24 }}>
              <StepBadge color={GREEN}>C&apos;est tout !</StepBadge>
              <h2 style={{ fontFamily: GEORGIA, fontSize: 18, fontWeight: 400, color: TEXT }}>Tu es prêt.</h2>
              <p className="mt-2" style={{ fontSize: 13, color: "rgba(28,26,21,0.5)", lineHeight: 1.6 }}>
                La prochaine fois que tu écoutes un titre sur Apple Music, ouvre le Raccourci et il sera partagé automatiquement dans ton feed BoredBoard.
              </p>
              <div className="mt-3 flex items-center justify-center" style={{ gap: 4 }} aria-hidden>
                <span style={{ background: "rgba(252,60,68,0.08)", borderRadius: 8, padding: 8, fontSize: 16 }}>♪</span>
                <span style={{ fontSize: 12, color: DIM }}>→</span>
                <span style={{ background: "rgba(42,53,96,0.08)", borderRadius: 8, padding: 8, fontSize: 16 }}>△</span>
                <span style={{ fontSize: 12, color: DIM }}>→</span>
                <span style={{ background: "rgba(196,169,74,0.08)", borderRadius: 8, padding: 8, fontSize: 16 }}>◉</span>
              </div>
              <p className="mt-2 text-center" style={{ fontSize: 10, color: DIM }}>Apple Music → Raccourci → BoredBoard</p>
            </section>
          </>
        )}

        {/* FAQ */}
        <section className="mb-8 mt-8">
          <h2 className="mb-4" style={{ fontSize: 11, color: DIM, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 400 }}>
            Questions fréquentes
          </h2>
          {faq.map((item) => (
            <FaqItem key={item.question} {...item} />
          ))}
        </section>
      </main>
    </div>
  );
}

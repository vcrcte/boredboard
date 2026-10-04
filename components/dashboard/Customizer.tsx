"use client";

import { useCallback, useEffect, useState } from "react";
import { FEED_ORDERS, MODULES, THEMES, type ModuleId, type Preferences } from "@/lib/preferences";

const CREAM = "#F7F4EE";
const INDIGO = "#2A3560";
const TEXT = "#1C1A15";
const GEORGIA = "Georgia, 'Times New Roman', serif";
const ink = (alpha: number) => `rgba(28,26,21,${alpha})`;
const black = (alpha: number) => `rgba(0,0,0,${alpha})`;
const DIM = ink(0.4);
const TRANSITION_MS = 350;

function Section({ title, subtitle, children, last = false }: { title: string; subtitle: string; children: React.ReactNode; last?: boolean }) {
  return (
    <section style={{ padding: "20px 24px", borderBottom: last ? "none" : `1px solid ${black(0.07)}` }}>
      <h3 style={{ fontSize: 9, color: ink(0.35), letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 400 }}>{title}</h3>
      <p className="mb-4 mt-1" style={{ fontSize: 11, color: DIM }}>{subtitle}</p>
      {children}
    </section>
  );
}

/** Drawer where the reader picks the feed's modules, themes and ordering. */
export default function Customizer({
  initial,
  onClose,
  onSave,
}: {
  initial: Preferences;
  onClose: () => void;
  /** Resolves with a status message to show under the save button. */
  onSave: (preferences: Preferences) => Promise<string>;
}) {
  const [draft, setDraft] = useState<Preferences>(initial);
  const [visible, setVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setVisible(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    setTimeout(onClose, TRANSITION_MS);
  }, [onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [close]);

  const toggleModule = (id: ModuleId) => setDraft({ ...draft, modules: { ...draft.modules, [id]: !draft.modules[id] } });
  const toggleTheme = (theme: string) =>
    setDraft({ ...draft, themes: draft.themes.includes(theme) ? draft.themes.filter((item) => item !== theme) : [...draft.themes, theme] });

  const save = async () => {
    setSaving(true);
    setStatus(await onSave(draft));
    setSaving(false);
  };

  return (
    <>
      <div
        className="fixed inset-0 z-50 backdrop-blur-sm"
        onClick={close}
        style={{ background: "rgba(0,0,0,0.3)", opacity: visible ? 1 : 0, transition: `opacity ${TRANSITION_MS}ms ease-out` }}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="customizer-title"
        className="fixed right-0 top-0 z-50 flex flex-col"
        style={{
          height: "100vh",
          width: "min(100vw, 360px)",
          background: "#FFFFFF",
          boxShadow: "-8px 0 40px rgba(0,0,0,0.1)",
          transform: visible ? "translateX(0)" : "translateX(100%)",
          transition: `transform ${TRANSITION_MS}ms cubic-bezier(0.16,1,0.3,1)`,
        }}
      >
        <header className="flex shrink-0 items-center justify-between" style={{ padding: "20px 24px", borderBottom: `1px solid ${black(0.07)}` }}>
          <h2 id="customizer-title" style={{ fontFamily: GEORGIA, fontSize: 18, fontWeight: 400, color: TEXT }}>
            Personnaliser mon espace
          </h2>
          <button type="button" onClick={close} aria-label="Fermer" className="hover:opacity-60" style={{ fontSize: 20, color: DIM, lineHeight: 1 }}>
            ✕
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <Section title="Mes modules" subtitle="Choisis les sections à afficher dans ton feed">
            <ul>
              {MODULES.map((module, index) => {
                const on = draft.modules[module.id];
                return (
                  <li key={module.id} style={{ borderBottom: index < MODULES.length - 1 ? `1px solid ${black(0.05)}` : "none" }}>
                    <label className="flex cursor-pointer items-center justify-between gap-3" style={{ padding: "10px 0" }}>
                      <span className="min-w-0">
                        <span className="block" style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>
                          <span aria-hidden>{module.icon}</span> {module.name}
                        </span>
                        <span className="mt-0.5 block" style={{ fontSize: 11, color: DIM }}>{module.description}</span>
                      </span>
                      <input type="checkbox" role="switch" checked={on} onChange={() => toggleModule(module.id)} className="sr-only" />
                      <span
                        aria-hidden
                        className="relative shrink-0"
                        style={{ width: 34, height: 20, borderRadius: 10, background: on ? INDIGO : "#E5E7EB", transition: "background-color 0.2s" }}
                      >
                        <span
                          className="absolute"
                          style={{ top: 2, left: 2, width: 16, height: 16, borderRadius: "50%", background: "#FFFFFF", boxShadow: "0 1px 2px rgba(0,0,0,0.2)", transform: on ? "translateX(14px)" : "translateX(0)", transition: "transform 0.2s" }}
                        />
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </Section>

          <Section title="Mes thèmes" subtitle="Le contenu sera filtré selon tes centres d'intérêt">
            <div className="flex flex-wrap" style={{ gap: 8 }}>
              {THEMES.map((theme) => {
                const on = draft.themes.includes(theme);
                return (
                  <button
                    key={theme}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleTheme(theme)}
                    style={{ borderRadius: 20, padding: "6px 14px", fontSize: 12, transition: "background-color 0.15s", ...(on ? { background: INDIGO, color: CREAM } : { background: "#F0EBE1", color: ink(0.6) }) }}
                  >
                    {theme}
                  </button>
                );
              })}
            </div>
          </Section>

          <Section title="Ordre du feed" subtitle="Priorité du contenu dans ton feed" last>
            <div role="radiogroup" aria-label="Ordre du feed" className="flex flex-col" style={{ gap: 8 }}>
              {FEED_ORDERS.map((option) => {
                const on = draft.order === option.id;
                return (
                  <label
                    key={option.id}
                    className="flex cursor-pointer items-center gap-3"
                    style={{ border: `1px solid ${on ? INDIGO : black(0.08)}`, background: on ? "rgba(42,53,96,0.04)" : "transparent", borderRadius: 10, padding: "10px 12px" }}
                  >
                    <input type="radio" name="feed-order" checked={on} onChange={() => setDraft({ ...draft, order: option.id })} className="sr-only" />
                    <span aria-hidden style={{ fontSize: 16 }}>{option.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block" style={{ fontSize: 13, fontWeight: 500, color: TEXT }}>
                        {option.name}
                        {option.id === "equilibre" && <span style={{ fontSize: 10, fontWeight: 400, color: DIM }}> · par défaut</span>}
                      </span>
                      <span className="block" style={{ fontSize: 11, color: DIM }}>{option.description}</span>
                    </span>
                    <span aria-hidden className="shrink-0" style={{ width: 14, height: 14, borderRadius: "50%", border: `1.5px solid ${on ? INDIGO : black(0.25)}`, boxShadow: on ? `inset 0 0 0 3px #FFFFFF, inset 0 0 0 7px ${INDIGO}` : "none" }} />
                  </label>
                );
              })}
            </div>
          </Section>
        </div>

        <div className="shrink-0">
          {status && (
            <p role="status" className="text-center" style={{ fontSize: 11, color: DIM, padding: "8px 24px" }}>{status}</p>
          )}
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="w-full transition hover:brightness-125 disabled:opacity-60"
            style={{ background: INDIGO, color: CREAM, padding: 14, fontWeight: 500, fontSize: 14 }}
          >
            {saving ? "Sauvegarde…" : "Sauvegarder"}
          </button>
        </div>
      </aside>
    </>
  );
}

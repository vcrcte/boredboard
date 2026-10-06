"use client";

import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import Navbar from "@/components/Navbar";
import { LASTFM_USERNAME } from "@/lib/lastfm";
import { THEMES } from "@/lib/preferences";
import { ensureProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

const CREAM = "#F7F4EE";
const INDIGO = "#2A3560";
const TEXT = "#1C1A15";
const GEORGIA = "Georgia, 'Times New Roman', serif";
const ink = (alpha: number) => `rgba(28,26,21,${alpha})`;
const black = (alpha: number) => `rgba(0,0,0,${alpha})`;
const DIM = ink(0.4);
const GREEN = "#16A34A";
const RED = "#C0392B";

const field: CSSProperties = {
  width: "100%",
  background: "#FFFFFF",
  border: `1px solid ${black(0.08)}`,
  borderRadius: 10,
  padding: "10px 14px",
  fontSize: 13,
  color: TEXT,
  outline: "none",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="mb-4" style={{ fontSize: 10, color: ink(0.35), letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 400 }}>
        {title}
      </h2>
      <div className="flex flex-col" style={{ gap: 14 }}>{children}</div>
    </section>
  );
}

function Field({ label, htmlFor, children }: { label: string; htmlFor: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1.5 block" style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>
        {label}
      </label>
      {children}
    </div>
  );
}

type Check = { state: "idle" | "checking" } | { state: "found"; name: string } | { state: "error"; message: string };

export default function Settings() {
  const router = useRouter();
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [loaded, setLoaded] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [lastfm, setLastfm] = useState("");
  const [check, setCheck] = useState<Check>({ state: "idle" });
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setSession(data.session);
    });
  }, [router]);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase.from("profiles").select("name, bio, location, interests").eq("id", userId).maybeSingle();
      setName(data?.name ?? "");
      setBio(data?.bio ?? "");
      setLocation(data?.location ?? "");
      setInterests(Array.isArray(data?.interests) ? data.interests : []);
      const { data: music } = await supabase.from("profiles").select("lastfm_username").eq("id", userId).maybeSingle();
      setLastfm(music?.lastfm_username ?? "");
      setLoaded(true);
    })();
  }, [userId]);

  const toggleInterest = (theme: string) => {
    setInterests((prev) => prev.includes(theme) ? prev.filter((t) => t !== theme) : [...prev, theme]);
  };

  const verify = async () => {
    const username = lastfm.trim();
    if (!LASTFM_USERNAME.test(username)) {
      setCheck({ state: "error", message: "Ce nom d'utilisateur n'est pas valide." });
      return;
    }
    setCheck({ state: "checking" });
    try {
      const res = await fetch(`/api/music/lastfm?username=${encodeURIComponent(username)}&method=user.getinfo`);
      const data = await res.json();
      if (res.status === 404) setCheck({ state: "error", message: "Aucun compte Last.fm à ce nom." });
      else if (!res.ok) setCheck({ state: "error", message: data.message ?? "Last.fm ne répond pas." });
      else setCheck({ state: "found", name: data.user?.realname || data.user?.name || username });
    } catch {
      setCheck({ state: "error", message: "Last.fm ne répond pas." });
    }
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!session) return;
    const username = lastfm.trim();
    if (username && !LASTFM_USERNAME.test(username)) {
      setStatus({ ok: false, message: "Le nom d'utilisateur Last.fm n'est pas valide." });
      return;
    }
    setSaving(true);
    setStatus(null);

    const profileError = await ensureProfile(session.user, name.trim() || undefined);
    const { error } = profileError
      ? { error: { message: profileError } }
      : await supabase
          .from("profiles")
          .update({ name: name.trim() || null, bio: bio.trim() || null, location: location.trim() || null, interests })
          .eq("id", session.user.id);
    if (error) {
      setStatus({ ok: false, message: `Enregistrement impossible : ${error.message}` });
      setSaving(false);
      return;
    }

    const { error: musicError } = await supabase
      .from("profiles")
      .update({ lastfm_username: username || null })
      .eq("id", session.user.id);
    setStatus(
      musicError
        ? { ok: false, message: "Profil enregistré, mais pas le compte Last.fm : la colonne lastfm_username manque dans Supabase." }
        : { ok: true, message: "Paramètres enregistrés." },
    );
    setSaving(false);
  };

  if (!session) return <div className="min-h-screen" style={{ background: CREAM }} />;

  return (
    <div className="min-h-screen" style={{ background: CREAM, color: TEXT, fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif" }}>
      <Navbar />
      <main className="mx-auto px-4 sm:px-10" style={{ maxWidth: 560, paddingBlock: 40 }}>
        <h1 className="mb-6" style={{ fontFamily: GEORGIA, fontSize: 28, fontWeight: 400, color: TEXT }}>Paramètres</h1>

        <form onSubmit={save} aria-busy={!loaded}>
          <Section title="Mon profil">
            <Field label="Nom" htmlFor="name">
              <input id="name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" style={field} />
            </Field>
            <Field label="Bio" htmlFor="bio">
              <textarea id="bio" value={bio} onChange={(event) => setBio(event.target.value)} rows={3} className="resize-none" style={{ ...field, lineHeight: 1.5 }} />
            </Field>
            <Field label="Localisation" htmlFor="location">
              <input id="location" value={location} onChange={(event) => setLocation(event.target.value)} placeholder="ex: Paris" style={field} />
            </Field>
          </Section>

          <Section title="Mes centres d'intérêt">
            <p style={{ fontSize: 12, color: DIM, lineHeight: 1.5, marginTop: -8 }}>
              Choisis tes centres d&apos;intérêt pour personnaliser ton feed et te connecter avec des profils similaires.
            </p>
            <div className="flex flex-wrap" style={{ gap: 8 }}>
              {THEMES.map((theme) => {
                const on = interests.includes(theme);
                return (
                  <button
                    key={theme}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggleInterest(theme)}
                    style={{
                      borderRadius: 20,
                      padding: "7px 16px",
                      fontSize: 13,
                      transition: "background-color 0.15s",
                      ...(on ? { background: INDIGO, color: CREAM } : { background: "#F0EBE1", color: ink(0.6) }),
                    }}
                  >
                    {theme}
                  </button>
                );
              })}
            </div>
            {interests.length > 0 && (
              <p style={{ fontSize: 11, color: ink(0.4) }}>
                {interests.length} {interests.length > 1 ? "thèmes sélectionnés" : "thème sélectionné"}
              </p>
            )}
          </Section>

          <Section title="Intégrations musicales">
            <div style={{ background: "#FFFFFF", border: `1px solid ${black(0.07)}`, borderRadius: 14, padding: 18 }}>
              <p style={{ fontSize: 14, fontWeight: 500, color: TEXT }}>
                <span aria-hidden>🎵</span> Last.fm
              </p>
              <p className="mt-1" style={{ fontSize: 12, color: DIM, lineHeight: 1.5 }}>
                Connecte ton compte Last.fm pour partager ta musique en temps réel
              </p>
              <label htmlFor="lastfm" className="mb-1.5 mt-4 block" style={{ fontSize: 12, fontWeight: 500, color: TEXT }}>
                Nom d&apos;utilisateur Last.fm
              </label>
              <div className="flex" style={{ gap: 8 }}>
                <input
                  id="lastfm"
                  value={lastfm}
                  onChange={(event) => {
                    setLastfm(event.target.value);
                    setCheck({ state: "idle" });
                  }}
                  placeholder="ex: vifiontedavis"
                  autoCapitalize="none"
                  spellCheck={false}
                  className="min-w-0 flex-1"
                  style={{ ...field, background: CREAM }}
                />
                <button
                  type="button"
                  onClick={verify}
                  disabled={!lastfm.trim() || check.state === "checking"}
                  className="shrink-0 hover:bg-black/[0.04] disabled:opacity-50"
                  style={{ border: `1px solid ${black(0.12)}`, borderRadius: 10, fontSize: 12, padding: "0 16px", color: TEXT }}
                >
                  {check.state === "checking" ? "…" : "Vérifier"}
                </button>
              </div>
              {check.state === "found" && (
                <p role="status" className="mt-2" style={{ fontSize: 12, color: GREEN }}>✓ Compte trouvé : {check.name}</p>
              )}
              {check.state === "error" && (
                <p role="alert" className="mt-2" style={{ fontSize: 12, color: RED }}>{check.message}</p>
              )}
            </div>
          </Section>

          <button
            type="submit"
            disabled={saving || !loaded}
            className="w-full transition hover:brightness-125 disabled:opacity-50"
            style={{ background: INDIGO, color: CREAM, borderRadius: 20, padding: "11px 24px", fontSize: 13, fontWeight: 500 }}
          >
            {saving ? "Enregistrement…" : "Sauvegarder"}
          </button>
          {status && (
            <p role={status.ok ? "status" : "alert"} className="mt-3 text-center" style={{ fontSize: 12, color: status.ok ? GREEN : RED }}>
              {status.message}
            </p>
          )}
        </form>
      </main>
    </div>
  );
}

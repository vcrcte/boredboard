"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar, { Logo } from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

const CREAM = "#F7F4EE";
const TEXT = "#1C1A15";
const DIM = "rgba(28,26,21,0.4)";
const MIN_INTERESTS = 3;

const topics = [
  "Géopolitique",
  "Histoire",
  "Philosophie",
  "Science",
  "Art & Design",
  "Littérature",
  "Musique",
  "Cinéma",
  "Architecture",
  "Économie",
  "Technologie",
  "Gastronomie",
  "Voyage",
  "Sport",
  "Photographie",
];

export default function Onboarding() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggle = (topic: string) =>
    setSelected((current) =>
      current.includes(topic)
        ? current.filter((item) => item !== topic)
        : [...current, topic],
    );

  const handleContinue = async () => {
    setError(null);
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setError("Tu dois être connecté pour enregistrer tes centres d'intérêt.");
      setSaving(false);
      return;
    }

    const { data, error: updateError } = await supabase
      .from("profiles")
      .update({ interests: selected })
      .eq("id", user.id)
      .select("id");

    if (updateError || data.length === 0) {
      setError(
        updateError?.message ??
          "Profil introuvable : tes centres d'intérêt n'ont pas été enregistrés.",
      );
      setSaving(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="page-enter min-h-screen antialiased" style={{ background: CREAM, color: TEXT }}>
      <Navbar />
      <main className="mx-auto flex max-w-[560px] flex-col items-center px-5 py-14 text-center">
        <Logo className="text-[22px]" />
        <h1 className="mt-10" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 26, fontWeight: 400, lineHeight: 1.25, color: TEXT }}>
          Qu&apos;est-ce qui t&apos;intéresse ?
        </h1>
        <p className="mt-2" style={{ fontSize: 13, color: DIM }}>
          Choisis au moins 3 sujets pour personnaliser ton feed
        </p>

        <div className="mt-8 flex flex-wrap justify-center" style={{ gap: 10 }}>
          {topics.map((topic) => {
            const isSelected = selected.includes(topic);
            return (
              <button
                key={topic}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggle(topic)}
                className={isSelected ? "bb-chip bb-chip-active" : "bb-chip bb-chip-inactive"}
                style={{
                  padding: "8px 18px",
                  fontSize: 13,
                  ...(isSelected ? {} : { border: "1px solid rgba(0,0,0,0.08)", background: "white" }),
                }}
              >
                {topic}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleContinue}
          disabled={selected.length < MIN_INTERESTS || saving}
          className="bb-btn-primary mt-10"
          style={{ height: 40, width: "100%", maxWidth: 240, borderRadius: 20 }}
        >
          {saving ? "Enregistrement…" : "Continuer"}
        </button>
        <p className="mt-3" style={{ fontSize: 12, color: DIM }}>
          {selected.length} sélectionné{selected.length > 1 ? "s" : ""}
        </p>
        {error && (
          <p role="alert" className="mt-2" style={{ fontSize: 12, color: "#C0392B" }}>
            {error}
          </p>
        )}
      </main>
    </div>
  );
}

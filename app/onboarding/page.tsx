"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar, { Logo } from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

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
    <div className="min-h-screen bg-[#F5F4F0] font-sans text-[#1C1B2E] antialiased">
      <Navbar />
      <main className="mx-auto flex max-w-[560px] flex-col items-center px-5 py-14 text-center">
        <Logo className="text-[22px]" />
        <h1 className="mt-10 font-serif text-[26px] leading-tight text-[#1C1B2E]">
          Qu&apos;est-ce qui t&apos;intéresse ?
        </h1>
        <p className="mt-2 text-[13px] text-[#888780]">
          Choisis au moins 3 sujets pour personnaliser ton feed
        </p>

        <div className="mt-8 flex flex-wrap justify-center gap-2.5">
          {topics.map((topic) => {
            const isSelected = selected.includes(topic);
            return (
              <button
                key={topic}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggle(topic)}
                className={`rounded-full border px-4 py-2 text-[13px] transition-colors ${
                  isSelected
                    ? "border-[#2A3560] bg-[#2A3560] text-white"
                    : "border-[#E8E8E8] bg-white text-[#1C1B2E] hover:border-[#2A3560]"
                }`}
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
          className="mt-10 h-10 w-full max-w-[240px] rounded-[20px] bg-[#2A3560] text-[13px] font-medium text-white transition-colors hover:bg-[#3D4F8C] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#2A3560]"
        >
          {saving ? "Enregistrement…" : "Continuer"}
        </button>
        <p className="mt-3 text-[12px] text-[#888780]">
          {selected.length} sélectionné{selected.length > 1 ? "s" : ""}
        </p>
        {error && (
          <p role="alert" className="mt-2 text-[12px] text-[#C0392B]">
            {error}
          </p>
        )}
      </main>
    </div>
  );
}

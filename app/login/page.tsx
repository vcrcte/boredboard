"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar, { Logo } from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

const inputClass =
  "h-10 w-full rounded-[8px] border border-[#E8E8E8] bg-white px-3 text-[13px] text-[#1C1B2E] outline-none transition-colors placeholder:text-[#888780] focus:border-[#3D4F8C]";

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isComplete = email.trim() !== "" && password !== "";

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSubmitting(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(
        signInError.code === "email_not_confirmed"
          ? "Confirme ton adresse email avant de te connecter."
          : "Email ou mot de passe incorrect",
      );
      setSubmitting(false);
      return;
    }

    router.push("/dashboard");
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F4F0] font-sans text-[#1C1B2E] antialiased">
      <Navbar />

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-[420px] rounded-[16px] border border-[#E8E8E8] bg-white p-10">
          <div className="text-center">
            <Logo className="text-[22px]" />
            <h1 className="mt-5 font-serif text-[20px] text-[#1C1B2E]">
              Bon retour
            </h1>
            <p className="mt-1.5 text-[13px] text-[#888780]">
              Content de te revoir
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-7 flex flex-col gap-3">
            <input
              type="email"
              name="email"
              value={email}
              placeholder="Adresse email"
              aria-label="Adresse email"
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              className={inputClass}
            />
            <input
              type="password"
              name="password"
              value={password}
              placeholder="Mot de passe"
              aria-label="Mot de passe"
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
            />
            <a href="#" className="self-end text-[12px] text-[#C4A94A] hover:underline">
              Mot de passe oublié ?
            </a>

            <button
              type="submit"
              disabled={!isComplete || submitting}
              className="mt-2 h-10 w-full rounded-[20px] bg-[#2A3560] text-[13px] font-medium text-white transition-colors hover:bg-[#3D4F8C] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#2A3560]"
            >
              {submitting ? "Connexion…" : "Se connecter"}
            </button>
            {error && (
              <p role="alert" className="text-center text-[12px] text-[#C0392B]">
                {error}
              </p>
            )}
          </form>

          <div className="my-6 flex items-center gap-3 text-[12px] text-[#888780]">
            <span className="h-px flex-1 bg-[#E8E8E8]" />
            ou
            <span className="h-px flex-1 bg-[#E8E8E8]" />
          </div>

          <p className="text-center text-[13px] text-[#888780]">
            Pas encore de compte ?{" "}
            <Link href="/signup" className="text-[#C4A94A] hover:underline">
              Rejoindre
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar, { Logo } from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

const CREAM = "#F7F4EE";
const GOLD = "#C4A94A";
const TEXT = "#1C1A15";
const DIM = "rgba(28,26,21,0.4)";

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
    <div className="page-enter flex min-h-screen flex-col antialiased" style={{ background: CREAM, color: TEXT }}>
      <Navbar />

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="bb-card w-full" style={{ maxWidth: 420, padding: "40px 40px 36px" }}>
          <div className="text-center">
            <Logo className="text-[22px]" />
            <h1 className="mt-5" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, fontWeight: 400, color: TEXT }}>
              Bon retour
            </h1>
            <p className="mt-1.5" style={{ fontSize: 13, color: DIM }}>
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
              className="bb-input"
              style={{ height: 40, fontSize: 13 }}
            />
            <input
              type="password"
              name="password"
              value={password}
              placeholder="Mot de passe"
              aria-label="Mot de passe"
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              className="bb-input"
              style={{ height: 40, fontSize: 13 }}
            />
            <a
              href="#"
              className="self-end transition"
              style={{ fontSize: 12, color: GOLD }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
            >
              Mot de passe oublié ?
            </a>

            <button
              type="submit"
              disabled={!isComplete || submitting}
              className="bb-btn-primary mt-2"
              style={{ height: 40, width: "100%", borderRadius: 20 }}
            >
              {submitting ? "Connexion…" : "Se connecter"}
            </button>
            {error && (
              <p role="alert" className="text-center" style={{ fontSize: 12, color: "#C0392B" }}>
                {error}
              </p>
            )}
          </form>

          <div className="my-6 flex items-center gap-3" style={{ fontSize: 12, color: DIM }}>
            <span className="h-px flex-1" style={{ background: "rgba(0,0,0,0.07)" }} />
            ou
            <span className="h-px flex-1" style={{ background: "rgba(0,0,0,0.07)" }} />
          </div>

          <p className="text-center" style={{ fontSize: 13, color: DIM }}>
            Pas encore de compte ?{" "}
            <Link href="/signup" style={{ color: GOLD }} className="hover:underline">
              Rejoindre
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

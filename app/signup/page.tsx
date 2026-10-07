"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar, { Logo } from "@/components/Navbar";
import { ensureProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

const CREAM = "#F7F4EE";
const GOLD = "#C4A94A";
const TEXT = "#1C1A15";
const DIM = "rgba(28,26,21,0.4)";
const ERROR_RED = "#C0392B";
const SUCCESS = "#3F8560";

type Field = "name" | "email" | "password";

const fields: {
  name: Field;
  type: string;
  placeholder: string;
  autoComplete: string;
}[] = [
  { name: "name", type: "text", placeholder: "Prénom & nom", autoComplete: "name" },
  { name: "email", type: "email", placeholder: "Adresse email", autoComplete: "email" },
  { name: "password", type: "password", placeholder: "Mot de passe", autoComplete: "new-password" },
];

function validate(field: Field, value: string): string | null {
  switch (field) {
    case "name":
      return value.trim() ? null : "Indique ton prénom et ton nom.";
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
        ? null
        : "Cette adresse email n'est pas valide.";
    case "password":
      return value.length >= 8
        ? null
        : "Le mot de passe doit contenir au moins 8 caractères.";
  }
}

function translateError(message?: string): string {
  if (!message) return "Une erreur est survenue. Réessaie dans un instant.";
  if (/already registered/i.test(message)) {
    return "Un compte existe déjà avec cette adresse email.";
  }
  if (/profiles_username_key/.test(message)) {
    return "Ce nom d'utilisateur est déjà pris.";
  }
  return message;
}

export default function Signup() {
  const [values, setValues] = useState<Record<Field, string>>({
    name: "",
    email: "",
    password: "",
  });
  const [touched, setTouched] = useState<Record<Field, boolean>>({
    name: false,
    email: false,
    password: false,
  });

  const isComplete =
    values.name.trim() !== "" && values.email.trim() !== "" && values.password !== "";

  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setTouched({ name: true, email: true, password: true });
    setFormError(null);
    setNotice(null);

    const isValid = fields.every(
      (field) => validate(field.name, values[field.name]) === null,
    );
    if (!isValid) return;

    const email = values.email.trim();
    const name = values.name.trim();
    setSubmitting(true);

    const { data, error } = await supabase.auth.signUp({
      email,
      password: values.password,
      options: { data: { name } },
    });

    if (error || !data.user) {
      setFormError(translateError(error?.message));
      setSubmitting(false);
      return;
    }

    if (data.user.identities?.length === 0) {
      setFormError("Un compte existe déjà avec cette adresse email.");
      setSubmitting(false);
      return;
    }

    if (!data.session) {
      setNotice(
        "Compte créé. Confirme ton adresse via l'email que nous venons d'envoyer pour continuer.",
      );
      setSubmitting(false);
      return;
    }

    const { error: upsertError } = await supabase.from("profiles").upsert({
      id: data.user.id,
      name,
      username: email.split("@")[0],
      created_at: new Date().toISOString(),
    });

    if (upsertError) {
      const profileError = await ensureProfile(data.user, name);
      if (profileError) {
        setFormError(translateError(profileError));
        setSubmitting(false);
        return;
      }
    }

    router.push("/onboarding");
  };

  return (
    <div className="page-enter flex min-h-screen flex-col antialiased" style={{ background: CREAM, color: TEXT }}>
      <Navbar />

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="bb-card w-full" style={{ maxWidth: 420, padding: "40px 40px 36px" }}>
          <div className="text-center">
            <Logo className="text-[22px]" />
            <h1 className="mt-5" style={{ fontFamily: "Georgia, 'Times New Roman', serif", fontSize: 20, fontWeight: 400, color: TEXT }}>
              Crée ton espace
            </h1>
            <p className="mt-1.5" style={{ fontSize: 13, color: DIM }}>
              Rejoins une communauté de curieux
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-7 flex flex-col gap-3">
            {fields.map((field) => {
              const fieldError = touched[field.name]
                ? validate(field.name, values[field.name])
                : null;
              return (
                <div key={field.name}>
                  <input
                    type={field.type}
                    name={field.name}
                    value={values[field.name]}
                    placeholder={field.placeholder}
                    aria-label={field.placeholder}
                    aria-invalid={fieldError !== null}
                    aria-describedby={fieldError ? `${field.name}-error` : undefined}
                    autoComplete={field.autoComplete}
                    onChange={(event) =>
                      setValues({ ...values, [field.name]: event.target.value })
                    }
                    onBlur={() => setTouched({ ...touched, [field.name]: true })}
                    className="bb-input"
                    style={{
                      height: 40,
                      width: "100%",
                      fontSize: 13,
                      ...(fieldError ? { borderColor: ERROR_RED } : {}),
                    }}
                  />
                  {fieldError && (
                    <p id={`${field.name}-error`} className="mt-1.5" style={{ fontSize: 12, color: ERROR_RED }}>
                      {fieldError}
                    </p>
                  )}
                </div>
              );
            })}

            <button
              type="submit"
              disabled={!isComplete || submitting}
              className="bb-btn-primary mt-2"
              style={{ height: 40, width: "100%", borderRadius: 20 }}
            >
              {submitting ? "Création…" : "Créer mon compte"}
            </button>
            {formError && (
              <p role="alert" className="text-center" style={{ fontSize: 12, color: ERROR_RED }}>
                {formError}
              </p>
            )}
            {notice && (
              <p role="status" className="text-center" style={{ fontSize: 12, color: SUCCESS }}>
                {notice}
              </p>
            )}
          </form>

          <div className="my-6 flex items-center gap-3" style={{ fontSize: 12, color: DIM }}>
            <span className="h-px flex-1" style={{ background: "rgba(0,0,0,0.07)" }} />
            ou
            <span className="h-px flex-1" style={{ background: "rgba(0,0,0,0.07)" }} />
          </div>

          <p className="text-center" style={{ fontSize: 13, color: DIM }}>
            Déjà un compte ?{" "}
            <Link href="/login" style={{ color: GOLD }} className="hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

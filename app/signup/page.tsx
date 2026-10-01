"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Navbar, { Logo } from "@/components/Navbar";
import { ensureProfile } from "@/lib/profile";
import { supabase } from "@/lib/supabase";

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

    // The name is also kept in the auth metadata, so the profile can still be
    // created at first sign-in when it can't be written right now.
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

    // With email confirmation enabled, Supabase answers an already-registered
    // address with a placeholder user that has no identities and no error.
    if (data.user.identities?.length === 0) {
      setFormError("Un compte existe déjà avec cette adresse email.");
      setSubmitting(false);
      return;
    }

    // No session means the address must be confirmed first: RLS rejects any
    // write to profiles until then, so the dashboard creates it at first sign-in.
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

    // Most likely the email prefix is already someone's username: retry with a
    // unique one rather than leaving the account without a profile.
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
    <div className="flex min-h-screen flex-col bg-[#F5F4F0] font-sans text-[#1C1B2E] antialiased">
      <Navbar />

      <main className="flex flex-1 items-center justify-center px-5 py-12">
        <div className="w-full max-w-[420px] rounded-[16px] border border-[#E8E8E8] bg-white p-10">
          <div className="text-center">
            <Logo className="text-[22px]" />
            <h1 className="mt-5 font-serif text-[20px] text-[#1C1B2E]">
              Crée ton espace
            </h1>
            <p className="mt-1.5 text-[13px] text-[#888780]">
              Rejoins une communauté de curieux
            </p>
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-7 flex flex-col gap-3">
            {fields.map((field) => {
              const error = touched[field.name]
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
                    aria-invalid={error !== null}
                    aria-describedby={error ? `${field.name}-error` : undefined}
                    autoComplete={field.autoComplete}
                    onChange={(event) =>
                      setValues({ ...values, [field.name]: event.target.value })
                    }
                    onBlur={() => setTouched({ ...touched, [field.name]: true })}
                    className={`h-10 w-full rounded-[8px] border bg-white px-3 text-[13px] text-[#1C1B2E] outline-none transition-colors placeholder:text-[#888780] ${
                      error
                        ? "border-[#C0392B]"
                        : "border-[#E8E8E8] focus:border-[#3D4F8C]"
                    }`}
                  />
                  {error && (
                    <p id={`${field.name}-error`} className="mt-1.5 text-[12px] text-[#C0392B]">
                      {error}
                    </p>
                  )}
                </div>
              );
            })}

            <button
              type="submit"
              disabled={!isComplete || submitting}
              className="mt-2 h-10 w-full rounded-[20px] bg-[#2A3560] text-[13px] font-medium text-white transition-colors hover:bg-[#3D4F8C] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-[#2A3560]"
            >
              {submitting ? "Création…" : "Créer mon compte"}
            </button>
            {formError && (
              <p role="alert" className="text-center text-[12px] text-[#C0392B]">
                {formError}
              </p>
            )}
            {notice && (
              <p role="status" className="text-center text-[12px] text-[#3F8560]">
                {notice}
              </p>
            )}
          </form>

          <div className="my-6 flex items-center gap-3 text-[12px] text-[#888780]">
            <span className="h-px flex-1 bg-[#E8E8E8]" />
            ou
            <span className="h-px flex-1 bg-[#E8E8E8]" />
          </div>

          <p className="text-center text-[13px] text-[#888780]">
            Déjà un compte ?{" "}
            <Link href="/login" className="text-[#C4A94A] hover:underline">
              Se connecter
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}

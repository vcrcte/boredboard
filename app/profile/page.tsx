"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import Navbar, { getInitials } from "@/components/Navbar";
import { supabase } from "@/lib/supabase";

type Profile = {
  username: string;
  name: string | null;
  bio: string | null;
  location: string | null;
  interests: string[] | null;
};

const tabs = ["Partages", "Podcasts", "Jeux", "Sauvegardés"];

const stats = [
  { value: "312", label: "interactions" },
  { value: "48", label: "abonnés" },
  { value: "21", label: "abonnements" },
  { value: "7j", label: "série" },
];

const following = [
  { name: "Sophie A.", tag: "Géopolitique", color: "bg-[#5B9A78]" },
  { name: "Léa R.", tag: "Musique", color: "bg-[#8B6BB5]" },
  { name: "Jules D.", tag: "Littérature", color: "bg-[#C4A94A]" },
  { name: "Malik T.", tag: "Philosophie", color: "bg-[#3D4F8C]" },
  { name: "Inès B.", tag: "Architecture", color: "bg-[#B5746B]" },
];

const books = [
  { title: "Sapiens", author: "Yuval Noah Harari", status: "En cours · 48%", color: "bg-[#C4A94A]" },
  { title: "Les Années", author: "Annie Ernaux", status: "En cours · 12%", color: "bg-[#3D4F8C]" },
  { title: "L'Usage du monde", author: "Nicolas Bouvier", status: "Dans ma liste", color: "bg-[#5B9A78]" },
];

const music = [
  { title: "Gymnopédie n°1", artist: "Erik Satie", color: "bg-[#8B6BB5]" },
  { title: "Clair de lune", artist: "Claude Debussy", color: "bg-[#3D4F8C]" },
  { title: "Spiegel im Spiegel", artist: "Arvo Pärt", color: "bg-[#B5746B]" },
];

const shares = [
  {
    pill: "Géopolitique",
    pillClass: "bg-[#E8F4EE] text-[#3F8560]",
    date: "il y a 2 jours",
    title: "L'Arctique, nouvelle frontière des routes maritimes",
    source: "Le Monde · lecture 6 min",
  },
  {
    pill: "Philosophie",
    pillClass: "bg-[#F1ECF8] text-[#7A5AA6]",
    date: "la semaine dernière",
    title: "Pourquoi l'ennui est le début de la pensée",
    source: "Philosophie Magazine · lecture 4 min",
  },
];

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[10px] font-medium uppercase tracking-[0.14em] text-[#888780]">
      {children}
    </h2>
  );
}

export default function ProfilePage() {
  const router = useRouter();
  // undefined while the session is still being read, null once known to be absent.
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState("Partages");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        router.replace("/login");
        return;
      }
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => subscription.unsubscribe();
  }, [router]);

  const userId = session?.user.id;

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("username, name, bio, location, interests")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setProfile(data);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  if (!session) {
    return <div className="min-h-screen bg-[#F5F4F0]" />;
  }

  const email = session.user.email;
  const displayName = profile?.name ?? email?.split("@")[0] ?? "";
  const username = profile?.username ?? email?.split("@")[0] ?? "";
  const interests = profile?.interests ?? [];

  return (
    <div className="flex min-h-screen flex-col bg-[#F5F4F0] font-sans text-[#1C1B2E] antialiased md:h-screen">
      <Navbar />

      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <aside className="shrink-0 overflow-y-auto border-b border-[#E8E8E8] bg-white p-4 md:w-[180px] md:border-b-0 md:border-r">
          <span className="flex h-[68px] w-[68px] items-center justify-center rounded-full bg-[#2A3560] font-serif text-[22px] text-white">
            {getInitials(profile?.name ?? null, email)}
          </span>
          <h1 className="mt-3 font-serif text-[16px] leading-snug text-[#1C1B2E]">
            {displayName}
          </h1>
          <p className="mt-0.5 break-words text-[11px] text-[#888780]">
            @{username}
            {profile?.location && ` · ${profile.location}`}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-[#888780]">
            {profile?.bio ?? "Pas encore de bio."}
          </p>
          <button
            type="button"
            className="mt-3 w-full rounded-md border border-[#E8E8E8] px-3 py-1.5 text-[12px] text-[#2A3560] transition-colors hover:border-[#2A3560]"
          >
            Modifier le profil
          </button>

          <div className="mt-4 grid grid-cols-2 gap-2">
            {stats.map((stat) => (
              <div key={stat.label} className="rounded-[8px] bg-[#F5F4F0] px-2 py-2.5 text-center">
                <p className="font-serif text-[15px] text-[#2A3560]">{stat.value}</p>
                <p className="text-[9px] text-[#888780]">{stat.label}</p>
              </div>
            ))}
          </div>

          <div className="mt-6">
            <SectionTitle>Abonnements</SectionTitle>
          </div>
          <ul className="mt-3 flex flex-col gap-3">
            {following.map((person) => (
              <li key={person.name} className="flex items-center gap-2">
                <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-medium text-white ${person.color}`}>
                  {person.name[0]}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[11px] font-medium text-[#1C1B2E]">
                    {person.name}
                  </p>
                  <p className="truncate text-[10px] text-[#888780]">{person.tag}</p>
                </div>
              </li>
            ))}
          </ul>
        </aside>

        <main className="min-w-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[680px] px-5 py-6">
            <div className="flex gap-6 border-b border-[#E8E8E8]">
              {tabs.map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setTab(item)}
                  aria-current={tab === item ? "page" : undefined}
                  className={`-mb-px border-b-2 pb-2.5 text-[13px] transition-colors ${
                    tab === item
                      ? "border-[#2A3560] font-medium text-[#2A3560]"
                      : "border-transparent text-[#888780] hover:text-[#2A3560]"
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <section className="rounded-[10px] border border-[#E8E8E8] bg-white p-4">
                <SectionTitle>Livres en cours</SectionTitle>
                <ul className="mt-3 flex flex-col gap-3">
                  {books.map((book) => (
                    <li key={book.title} className="flex items-center gap-3">
                      <span className={`h-11 w-2 shrink-0 rounded-[2px] ${book.color}`} />
                      <div className="min-w-0">
                        <p className="truncate font-serif text-[13px] text-[#1C1B2E]">
                          {book.title}
                        </p>
                        <p className="truncate text-[11px] text-[#888780]">
                          {book.author}
                        </p>
                        <p className="text-[10px] text-[#C4A94A]">{book.status}</p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-[10px] border border-[#E8E8E8] bg-white p-4">
                <SectionTitle>Musique récente</SectionTitle>
                <ul className="mt-3 flex flex-col gap-3">
                  {music.map((track) => (
                    <li key={track.title} className="flex items-center gap-3">
                      <span className={`h-11 w-11 shrink-0 rounded-md ${track.color}`} />
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-[#1C1B2E]">
                          {track.title}
                        </p>
                        <p className="truncate text-[11px] text-[#888780]">
                          {track.artist}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            <div className="mt-4 flex flex-col gap-4">
              {tab === "Partages" ? (
                shares.map((share) => (
                  <article key={share.title} className="rounded-[10px] border border-[#E8E8E8] bg-white p-5">
                    <div className="flex items-center gap-2 text-[11px] text-[#888780]">
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-medium ${share.pillClass}`}>
                        {share.pill}
                      </span>
                      <span>·</span>
                      <span>Partagé {share.date}</span>
                    </div>
                    <h3 className="mt-3 font-serif text-[17px] leading-snug text-[#1C1B2E]">
                      {share.title}
                    </h3>
                    <p className="mt-2 text-[11px] text-[#888780]">{share.source}</p>
                  </article>
                ))
              ) : (
                <p className="rounded-[10px] border border-dashed border-[#E8E8E8] px-5 py-10 text-center text-[13px] text-[#888780]">
                  Rien dans « {tab} » pour l&apos;instant.
                </p>
              )}
            </div>
          </div>
        </main>

        <aside className="hidden w-[240px] shrink-0 overflow-y-auto border-l border-[#E8E8E8] bg-white p-5 lg:block">
          <SectionTitle>Centres d&apos;intérêt</SectionTitle>
          {interests.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {interests.map((interest) => (
                <span key={interest} className="rounded-full bg-[#EEF0F8] px-2.5 py-1 text-[11px] text-[#2A3560]">
                  {interest}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-[11px] text-[#888780]">
              Aucun sujet choisi pour l&apos;instant.
            </p>
          )}
        </aside>
      </div>
    </div>
  );
}

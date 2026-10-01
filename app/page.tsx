import Link from "next/link";
import Navbar, { Logo } from "@/components/Navbar";

const serif = "font-serif";

const footerLinks = ["Manifeste", "Confidentialité", "Contact"];

const avatars = [
  { initial: "L", color: "bg-[#3D4F8C]" },
  { initial: "M", color: "bg-[#C4A94A]" },
  { initial: "S", color: "bg-[#5B9A78]" },
  { initial: "A", color: "bg-[#8B6BB5]" },
];

const features = [
  {
    title: "Ton dashboard, ta règle",
    description:
      "Choisis tes modules, réorganise-les, masque ce qui t'ennuie. Ta page d'accueil ne ressemble à aucune autre.",
    bg: "bg-[#EEF0F8]",
    color: "text-[#2A3560]",
    icon: (
      <>
        <rect x="3" y="3" width="7" height="9" rx="1.5" />
        <rect x="14" y="3" width="7" height="5" rx="1.5" />
        <rect x="14" y="12" width="7" height="9" rx="1.5" />
        <rect x="3" y="16" width="7" height="5" rx="1.5" />
      </>
    ),
  },
  {
    title: "Suis des esprits curieux",
    description:
      "Découvre ce que lisent, écoutent et explorent les gens qui te ressemblent — sans algorithme qui crie.",
    bg: "bg-[#FDF7E8]",
    color: "text-[#C4A94A]",
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" />
        <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8" />
        <path d="M18 14.3c2.1.7 3.5 2.6 3.5 5.7" />
      </>
    ),
  },
  {
    title: "Joue, apprends, répète",
    description:
      "Des mini-jeux de deux minutes pour muscler ta culture générale, entre deux articles ou deux chansons.",
    bg: "bg-[#E8F4EE]",
    color: "text-[#3F8560]",
    icon: (
      <path d="M10 3.5a2 2 0 1 1 4 0V5h4a1 1 0 0 1 1 1v4h1.5a2 2 0 1 1 0 4H19v5a1 1 0 0 1-1 1h-4.5v-1.5a2 2 0 1 0-4 0V20H5a1 1 0 0 1-1-1v-4.5h1.5a2 2 0 1 0 0-4H4V6a1 1 0 0 1 1-1h5V3.5Z" />
    ),
  },
];

function DashboardPreview() {
  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex h-10 shrink-0 items-center justify-between rounded-[10px] border border-[#E8E8E8] bg-white px-3.5">
        <Logo className="text-[13px]" />
        <div className="flex items-center gap-3.5 text-[10px] text-[#888780]">
          <span className="font-medium text-[#2A3560]">Aujourd&apos;hui</span>
          <span>Lire</span>
          <span>Écouter</span>
          <span>Jouer</span>
        </div>
        <span className="h-5 w-5 rounded-full bg-[#3D4F8C]" />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-5 grid-rows-2 gap-3">
        <div className="col-span-3 flex flex-col justify-between rounded-[10px] border border-[#E8E8E8] bg-white p-3.5">
          <p className="text-[9px] uppercase tracking-[0.14em] text-[#888780]">
            À la une
          </p>
          <div>
            <span className="rounded-full bg-[#E8F4EE] px-2 py-0.5 text-[9px] font-medium text-[#3F8560]">
              Géopolitique
            </span>
            <p className={`${serif} mt-1.5 text-[12px] leading-snug text-[#1C1B2E]`}>
              L&apos;Arctique, nouvelle frontière des routes maritimes
            </p>
          </div>
          <div className="border-t border-[#E8E8E8] pt-2.5">
            <span className="rounded-full bg-[#F1ECF8] px-2 py-0.5 text-[9px] font-medium text-[#7A5AA6]">
              Philosophie
            </span>
            <p className={`${serif} mt-1.5 text-[12px] leading-snug text-[#1C1B2E]`}>
              Pourquoi l&apos;ennui est le début de la pensée
            </p>
          </div>
        </div>

        <div className="col-span-2 flex flex-col justify-between rounded-[10px] border border-[#E8E8E8] bg-white p-3.5">
          <p className="text-[9px] uppercase tracking-[0.14em] text-[#888780]">
            En écoute
          </p>
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#EEF0F8] text-[#3D4F8C]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M9 18V5l11-2v13" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="17" cy="16" r="3" />
              </svg>
            </span>
            <div className="min-w-0">
              <p className="truncate text-[11px] font-semibold text-[#1C1B2E]">
                Gymnopédie n°1
              </p>
              <p className="truncate text-[10px] text-[#888780]">Erik Satie</p>
            </div>
          </div>
          <div>
            <div className="h-1 rounded-full bg-[#EEF0F8]">
              <div className="h-1 w-[62%] rounded-full bg-[#3D4F8C]" />
            </div>
            <div className="mt-1 flex justify-between text-[9px] text-[#888780]">
              <span>1:58</span>
              <span>3:12</span>
            </div>
          </div>
        </div>

        <div className="col-span-2 flex flex-col justify-between rounded-[10px] bg-[#2A3560] p-3.5 text-white">
          <svg viewBox="0 0 24 24" className="h-7 w-7 text-[#C4A94A]" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden>
            <circle cx="12" cy="12" r="9" />
            <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3Z" />
          </svg>
          <div>
            <p className={`${serif} text-[14px]`}>GéoBlitz</p>
            <p className="mt-0.5 text-[10px] text-white/60">
              10 capitales en 60 secondes
            </p>
          </div>
          <span className="self-start rounded-full bg-white/10 px-2.5 py-1 text-[10px]">
            Jouer →
          </span>
        </div>

        <div className="col-span-3 flex flex-col justify-between rounded-[10px] border border-[#E8E8E8] bg-white p-3.5">
          <p className="text-[9px] uppercase tracking-[0.14em] text-[#888780]">
            Lecture en cours
          </p>
          <div className="flex items-center gap-3">
            <span className={`${serif} flex h-14 w-10 shrink-0 items-center justify-center rounded-[3px] bg-[#FDF7E8] text-[16px] text-[#C4A94A]`}>
              S
            </span>
            <div>
              <p className={`${serif} text-[13px] text-[#1C1B2E]`}>Sapiens</p>
              <p className="text-[10px] text-[#888780]">Yuval Noah Harari</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="h-1 flex-1 rounded-full bg-[#F5F4F0]">
              <div className="h-1 w-[48%] rounded-full bg-[#C4A94A]" />
            </div>
            <span className="text-[10px] font-medium text-[#C4A94A]">48%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <div className="min-h-screen bg-[#F5F4F0] font-sans text-[#1C1B2E] antialiased">
      <Navbar />

      <main>
        <section className="grid border-b border-[#E8E8E8] md:h-[480px] md:grid-cols-2">
          <div className="flex bg-white md:justify-end">
            <div className="flex w-full max-w-[560px] flex-col justify-center px-6 py-14 md:px-10 md:py-0">
              <p className="text-[10px] font-medium tracking-[0.14em] text-[#C4A94A]">
                POUR LES ESPRITS CURIEUX
              </p>
              <h1 className={`${serif} mt-4 text-[36px] leading-[1.15] text-[#1C1B2E]`}>
                L&apos;endroit où ton ennui devient une richesse
              </h1>
              <p className="mt-4 max-w-[420px] text-[14px] leading-relaxed text-[#888780]">
                Un dashboard vivant qui mêle actualités, culture, musique,
                livres et mini-jeux — personnalisé selon ce qui t&apos;intéresse
                vraiment.
              </p>
              <div className="mt-7 flex flex-wrap gap-2.5">
                <Link href="/dashboard" className="rounded-md bg-[#2A3560] px-4 py-2.5 text-[13px] font-medium text-white transition-colors hover:bg-[#3D4F8C]">
                  Découvrir gratuitement
                </Link>
                <a href="#" className="rounded-md border border-[#E8E8E8] px-4 py-2.5 text-[13px] text-[#2A3560] transition-colors hover:border-[#2A3560]">
                  <span className="mr-1.5 text-[10px]">▶</span>
                  Voir comment ça marche
                </a>
              </div>
              <div className="mt-8 flex items-center gap-3">
                <div className="flex -space-x-2">
                  {avatars.map((avatar) => (
                    <span
                      key={avatar.initial}
                      className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white text-[10px] font-medium text-white ${avatar.color}`}
                    >
                      {avatar.initial}
                    </span>
                  ))}
                </div>
                <p className="text-[12px] text-[#888780]">
                  Rejoint par{" "}
                  <span className="font-medium text-[#1C1B2E]">
                    2 400 curieux
                  </span>{" "}
                  cette semaine
                </p>
              </div>
            </div>
          </div>

          <div className="bg-[#F5F4F0]">
            <div className="h-[480px] w-full max-w-[560px] px-6 py-8 md:h-full md:px-10">
              <DashboardPreview />
            </div>
          </div>
        </section>

        <section className="border-b border-[#E8E8E8] bg-white">
          <div className="mx-auto grid max-w-[1120px] gap-10 px-6 py-16 md:grid-cols-3 md:px-10">
            {features.map((feature) => (
              <div key={feature.title}>
                <span className={`flex h-9 w-9 items-center justify-center rounded-[10px] ${feature.bg} ${feature.color}`}>
                  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    {feature.icon}
                  </svg>
                </span>
                <h2 className="mt-4 text-[14px] font-bold text-[#1C1B2E]">
                  {feature.title}
                </h2>
                <p className="mt-1.5 max-w-[280px] text-[12px] leading-relaxed text-[#888780]">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden bg-white">
          <div className="mx-auto flex max-w-[1120px] items-center justify-between gap-10 px-6 py-16 md:px-10">
            <div className="shrink-0">
              <h2 className={`${serif} max-w-[380px] text-[26px] leading-tight text-[#1C1B2E]`}>
                Prêt à transformer ton ennui en curiosité ?
              </h2>
              <p className="mt-3 text-[13px] text-[#888780]">
                Rejoins la liste d&apos;attente. Accès gratuit, sans carte
                bancaire.
              </p>
              <form className="mt-6 flex flex-wrap gap-2">
                <input
                  type="email"
                  name="email"
                  required
                  placeholder="ton@email.fr"
                  aria-label="Adresse email"
                  className="h-10 w-[230px] rounded-md border border-[#E8E8E8] bg-white px-3 text-[13px] text-[#1C1B2E] outline-none transition-colors placeholder:text-[#888780] focus:border-[#3D4F8C]"
                />
                <button
                  type="button"
                  className="h-10 rounded-md bg-[#2A3560] px-4 text-[13px] font-medium text-white transition-colors hover:bg-[#3D4F8C]"
                >
                  Rejoindre la beta
                </button>
              </form>
            </div>
            <p
              aria-hidden
              className={`${serif} hidden select-none whitespace-nowrap text-[104px] leading-none tracking-tight text-[#EEF0F8] lg:block`}
            >
              Bored<span className="text-[#C4A94A]">Board</span>
            </p>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#E8E8E8] bg-white">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-4 px-6 py-6 md:px-10">
          <Logo className="text-[16px]" />
          <ul className="flex items-center gap-6">
            {footerLinks.map((link) => (
              <li key={link}>
                <a href="#" className="text-[12px] text-[#888780] transition-colors hover:text-[#2A3560]">
                  {link}
                </a>
              </li>
            ))}
          </ul>
          <p className="text-[12px] text-[#888780]">© 2026 BoredBoard</p>
        </div>
      </footer>
    </div>
  );
}

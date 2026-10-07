import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Culture — BoredBoard",
  description: "Découvrez un nouveau sujet culturel chaque jour. Philosophie, science, art, histoire et plus encore.",
};

export default function CultureLayout({ children }: { children: React.ReactNode }) {
  return children;
}

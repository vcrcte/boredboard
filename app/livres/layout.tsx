import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Livres — BoredBoard",
  description: "Ta bibliothèque personnelle et les lectures de ton réseau",
};

export default function LivresLayout({ children }: { children: React.ReactNode }) {
  return children;
}

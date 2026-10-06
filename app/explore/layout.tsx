import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Explorer — BoredBoard",
  description: "Découvre des profils qui partagent tes centres d'intérêt",
};

export default function ExploreLayout({ children }: { children: React.ReactNode }) {
  return children;
}

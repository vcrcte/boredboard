import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Newsletter — BoredBoard",
  description: "Tes newsletters culturelles personnalisées",
};

export default function NewsletterLayout({ children }: { children: React.ReactNode }) {
  return children;
}

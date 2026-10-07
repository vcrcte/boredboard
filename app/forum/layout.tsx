import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Forum · BoredBoard",
  description: "Discutez culture, séries, musique et plus avec la communauté BoredBoard.",
};

export default function ForumLayout({ children }: { children: React.ReactNode }) {
  return children;
}

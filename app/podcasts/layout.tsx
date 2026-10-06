import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Podcasts — BoredBoard",
  description: "Tes podcasts culturels préférés",
};

export default function PodcastsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import { NextResponse } from "next/server";
import { issueShortcutToken } from "@/lib/shortcut-token";
import { clientForRequest } from "@/lib/supabase-server";

// Everything needed to set up the Apple Shortcut, for the signed-in user:
// a fresh token and the actions to add, with every value already filled in.
// (Tokens are stored hashed, so an existing one can't be read back: each call
// issues a new one and disconnects the previous Shortcut.)

export async function GET(request: Request) {
  const auth = await clientForRequest(request);
  if (!auth) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const result = await issueShortcutToken(auth.supabase, auth.user.id);
  if ("error" in result) return NextResponse.json(result, { status: 500 });

  const endpoint = `${process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin}/api/shortcuts/music`;
  return NextResponse.json({
    token: result.token,
    endpoint,
    shortcutUrl: process.env.NEXT_PUBLIC_SHORTCUT_ICLOUD_URL || null,
    steps: [
      { icon: "🎵", action: "Obtenir le morceau en cours", detail: "Lit le titre joué par l'app Musique." },
      {
        icon: "🌐",
        action: "Obtenir le contenu de l'URL",
        detail: "Envoie le titre à BoredBoard.",
        fields: {
          URL: endpoint,
          Méthode: "POST",
          "Corps de la requête": "JSON",
          token: result.token,
          title: "Morceau en cours › Nom",
          artist: "Morceau en cours › Artiste",
          platform: "apple",
        },
      },
      { icon: "🔔", action: "Afficher la notification", detail: "Affiche « … partagé sur BoredBoard ! »." },
    ],
  });
}

import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { buildShortcutPlist, canSignShortcuts, signShortcut } from "@/lib/shortcut-file";
import { serviceClient } from "@/lib/supabase-server";

// Downloads the "BoredBoard Music" Shortcut with the user's token built in.
// GET ?check=1 only says whether this server can produce it (see lib/shortcut-file.ts).
// GET ?generic=1 builds the shared file, without a token (asked at install),
// published as public/BoredBoard-Music.shortcut; in development only, ?api=
// sets the address it posts to (normally the deployed site).

export async function GET(request: Request) {
  const url = new URL(request.url);
  const signing = await canSignShortcuts();
  if (url.searchParams.has("check")) return NextResponse.json({ signing });

  if (url.searchParams.has("generic")) {
    if (!signing) return NextResponse.json({ error: "La signature Apple n'est possible que sur un Mac." }, { status: 501 });
    const api = process.env.NODE_ENV !== "production" ? url.searchParams.get("api") : null;
    const base = (api || process.env.SHORTCUT_API_URL || url.origin).replace(/\/$/, "");
    if (!/^https?:\/\//.test(base)) return NextResponse.json({ error: "Adresse invalide" }, { status: 400 });
    const file = await signShortcut(buildShortcutPlist(`${base}/api/shortcuts/music`, null));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="BoredBoard Music.shortcut"',
      },
    });
  }

  const token = url.searchParams.get("token")?.trim();
  if (!token) return NextResponse.json({ error: "Token requis" }, { status: 401 });
  if (!signing) {
    return NextResponse.json(
      { error: "Ce serveur ne peut pas signer de Raccourci : la signature Apple n'est possible que sur un Mac." },
      { status: 501 },
    );
  }

  const supabase = serviceClient();
  if (!supabase) return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY manque sur le serveur." }, { status: 503 });

  // Tokens from /raccourci are stored as their SHA-256; one typed by hand is stored as is.
  const hash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await supabase.from("shortcut_tokens").select("user_id").in("token", [hash, token]).limit(1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data?.length) return NextResponse.json({ error: "Token invalide" }, { status: 401 });

  // The Shortcut posts back to this server unless SHORTCUT_API_URL says otherwise.
  // NEXT_PUBLIC_SITE_URL isn't used: a wrong value there would send the token to another site.
  const origin = (process.env.SHORTCUT_API_URL || url.origin).replace(/\/$/, "");

  try {
    const file = await signShortcut(buildShortcutPlist(`${origin}/api/shortcuts/music`, token));
    return new NextResponse(new Uint8Array(file), {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": 'attachment; filename="BoredBoard Music.shortcut"',
        "Cache-Control": "no-store",
      },
    });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : String(cause);
    return NextResponse.json({ error: `La signature du Raccourci a échoué : ${message}` }, { status: 500 });
  }
}

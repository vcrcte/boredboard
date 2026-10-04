import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { clientForRequest } from "@/lib/supabase-server";

// Personal token for the Apple Shortcut. Called from /raccourci with the
// signed-in user's access token. Only the token's hash is stored, so it is
// shown once: asking again replaces it (and disconnects the old Shortcut).

export async function POST(request: Request) {
  const auth = await clientForRequest(request);
  if (!auth) return NextResponse.json({ error: "Non connecté" }, { status: 401 });

  const token = `bb_${randomBytes(32).toString("base64url")}`;
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const { error } = await auth.supabase
    .from("shortcut_tokens")
    .upsert({ user_id: auth.user.id, token_hash: tokenHash, created_at: new Date().toISOString() }, { onConflict: "user_id" });

  if (error) {
    const message =
      error.code === "23503"
        ? "Ouvre ton dashboard une première fois pour créer ton profil."
        : /shortcut_tokens/.test(error.message)
          ? "La table shortcut_tokens n'existe pas encore : exécute la migration Supabase."
          : error.message;
    return NextResponse.json({ error: message }, { status: 500 });
  }
  return NextResponse.json({ token, user: auth.user.email });
}

/** Revokes the token: the Shortcut stops working. */
export async function DELETE(request: Request) {
  const auth = await clientForRequest(request);
  if (!auth) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { error } = await auth.supabase.from("shortcut_tokens").delete().eq("user_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

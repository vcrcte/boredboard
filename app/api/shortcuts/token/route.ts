import { NextResponse } from "next/server";
import { issueShortcutToken } from "@/lib/shortcut-token";
import { clientForRequest } from "@/lib/supabase-server";

// The Shortcut token on its own (see lib/shortcut-token.ts). The site keeps
// its Supabase session in the browser, not in cookies, so the page sends its
// access token as "Authorization: Bearer …".

async function issueToken(request: Request) {
  const auth = await clientForRequest(request);
  if (!auth) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const result = await issueShortcutToken(auth.supabase, auth.user.id);
  if ("error" in result) return NextResponse.json(result, { status: 500 });
  return NextResponse.json({ token: result.token, user: auth.user.email });
}

export const GET = issueToken;
export const POST = issueToken;

/** Revokes the token: the Shortcut stops working. */
export async function DELETE(request: Request) {
  const auth = await clientForRequest(request);
  if (!auth) return NextResponse.json({ error: "Non connecté" }, { status: 401 });
  const { error } = await auth.supabase.from("shortcut_tokens").delete().eq("user_id", auth.user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

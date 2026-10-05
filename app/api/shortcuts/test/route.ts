import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// TEMPORARY debug route: lists the Shortcut tokens with the service role key.
// Disabled in production, where it would expose every token to anyone.

const PROBE = "boredboard-victor-2026";

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: all, error: allError } = await supabase.from("shortcut_tokens").select("*");
  // The table normally holds SHA-256 hashes: look the probe up both ways.
  const { data: plain } = await supabase.from("shortcut_tokens").select("*").eq("token", PROBE).maybeSingle();
  const { data: hashed } = await supabase
    .from("shortcut_tokens")
    .select("*")
    .eq("token", createHash("sha256").update(PROBE).digest("hex"))
    .maybeSingle();

  return NextResponse.json({
    env: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    allError: allError?.message ?? null,
    all,
    specific: { asPlainText: plain, asHash: hashed },
  });
}

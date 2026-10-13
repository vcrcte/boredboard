// Which shared post brought a new account (docs/designs/first-20-users.md).
// /raccourci?ref=<post id> remembers it on this device; the first signed-in
// page after signup writes it to profiles.referred_by_post (once).

import { supabase } from "@/lib/supabase";

const KEY = "bb-ref";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function rememberReferral(ref: string | null) {
  if (!ref || !UUID.test(ref)) return;
  try {
    localStorage.setItem(KEY, ref);
  } catch {
    // Storage blocked: the referral is just not counted.
  }
}

/** Writes the remembered referral to the user's profile if it has none yet, then forgets it. */
export async function claimReferral(userId: string) {
  let ref: string | null = null;
  try {
    ref = localStorage.getItem(KEY);
  } catch {
    return;
  }
  if (!ref || !UUID.test(ref)) return;
  const { error } = await supabase.from("profiles").update({ referred_by_post: ref }).eq("id", userId).is("referred_by_post", null);
  // Only forget it once written (or when the column/post doesn't accept it), so a network error retries next time.
  if (!error || error.code) {
    try {
      localStorage.removeItem(KEY);
    } catch {
      // Nothing to clean up.
    }
  }
}

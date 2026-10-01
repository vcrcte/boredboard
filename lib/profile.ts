import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

const UNIQUE_VIOLATION = "23505";

async function profileExists(userId: string) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle();
  return { exists: data !== null, error };
}

/**
 * Makes sure the signed-in user has a row in public.profiles, creating it from
 * the auth data when missing. Returns an error message, or null on success.
 * An existing profile is never modified.
 */
export async function ensureProfile(user: User, name?: string): Promise<string | null> {
  const { exists, error } = await profileExists(user.id);
  if (error) return error.message;
  if (exists) return null;

  const base = (user.email ?? "").split("@")[0] || "curieux";
  const profileName: string | null = name ?? user.user_metadata?.name ?? null;

  // The email prefix may already be taken by someone else, so fall back to a
  // username made unique with the start of the user id.
  for (const username of [base, `${base}-${user.id.slice(0, 6)}`]) {
    const { error: insertError } = await supabase
      .from("profiles")
      .insert({ id: user.id, name: profileName, username });
    if (!insertError) return null;
    if (insertError.code !== UNIQUE_VIOLATION) return insertError.message;
  }

  // Both attempts hit a unique violation: either the profile was created
  // concurrently (fine) or both usernames are really taken.
  const recheck = await profileExists(user.id);
  return recheck.exists ? null : "Impossible de créer le profil : nom d'utilisateur déjà pris.";
}

import { createHash, randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

// Personal token for the Apple Shortcut. public.shortcut_tokens(user_id, token)
// stores the SHA-256 of the token, never the token itself: it can only be
// shown when it is created, and creating a new one disconnects the previous
// Shortcut.

/** Creates (or replaces) the user's token. Returns it, or a readable error. */
export async function issueShortcutToken(supabase: SupabaseClient, userId: string): Promise<{ token: string } | { error: string }> {
  const token = randomUUID();
  const { error } = await supabase
    .from("shortcut_tokens")
    .upsert({ user_id: userId, token: createHash("sha256").update(token).digest("hex") }, { onConflict: "user_id" });

  if (!error) return { token };
  if (error.code === "23503") return { error: "Ouvre ton dashboard une première fois pour créer ton profil." };
  if (error.code === "42P01") return { error: "La table shortcut_tokens n'existe pas : exécute la migration Supabase." };
  if (error.code === "42P10") {
    return { error: "La table shortcut_tokens n'a pas de contrainte unique sur user_id : exécute la migration Supabase." };
  }
  if (error.code === "42501") {
    return { error: "Supabase refuse l'écriture dans shortcut_tokens : la règle de sécurité manque, exécute la migration." };
  }
  return { error: `Impossible d'enregistrer le token : ${error.message}` };
}

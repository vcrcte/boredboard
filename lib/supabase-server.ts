import { createClient } from "@supabase/supabase-js";

/**
 * A Supabase client acting as the user who sent `Authorization: Bearer <token>`
 * (the site keeps its session in the browser, not in cookies, so API routes
 * receive the access token explicitly). Queries run under row-level security.
 */
export async function clientForRequest(request: Request) {
  const token = /^Bearer (.+)$/.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) return null;

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const {
    data: { user },
  } = await supabase.auth.getUser(token);
  return user ? { supabase, user } : null;
}

/** An anonymous client, for calls whose access is checked in the database itself. */
export function anonClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * A client with the service role key: it bypasses row-level security, so it
 * must only be used in server code that checks access itself. null when the
 * key isn't configured (SUPABASE_SERVICE_ROLE_KEY, never NEXT_PUBLIC_).
 */
export function serviceClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// Signs the listener in to BoredBoard (Supabase) and publishes the shared
// tracks. The popup only talks to this worker, so a share in progress isn't
// lost when the popup closes.

// Chrome loads this file as a service worker (config.js imported here);
// Firefox loads both through "background.scripts".
if (typeof BOREDBOARD_CONFIG === "undefined" && typeof importScripts === "function") {
  importScripts("config.js");
}

const { supabaseUrl, supabaseAnonKey } = BOREDBOARD_CONFIG;
const SESSION_KEY = "session";

async function auth(grantType, body) {
  const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=${grantType}`, {
    method: "POST",
    headers: { apikey: supabaseAnonKey, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || "Connexion impossible");
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + data.expires_in * 1000,
    userId: data.user.id,
    email: data.user.email,
  };
}

async function getStoredSession() {
  const stored = await chrome.storage.local.get(SESSION_KEY);
  return stored[SESSION_KEY] ?? null;
}

/** The stored session, refreshed when it expires within a minute; null when signed out. */
async function getSession() {
  const session = await getStoredSession();
  if (!session) return null;
  if (session.expiresAt - Date.now() > 60_000) return session;
  try {
    const refreshed = await auth("refresh_token", { refresh_token: session.refreshToken });
    await chrome.storage.local.set({ [SESSION_KEY]: refreshed });
    return refreshed;
  } catch {
    await chrome.storage.local.remove(SESSION_KEY);
    return null;
  }
}

// Published by the site (app/api/posts/music), which adds the platform's
// canonical title and cover and inserts the post as the signed-in user.
async function share({ track, comment }) {
  const session = await getSession();
  if (!session) throw new Error("Connecte-toi d'abord.");

  let res;
  try {
    res = await fetch(`${BOREDBOARD_CONFIG.appUrl}/api/posts/music`, {
      method: "POST",
      headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify({ track, comment }),
    });
  } catch {
    throw new Error("BoredBoard est injoignable. Le site est-il lancé ?");
  }
  if (res.status === 401) {
    await chrome.storage.local.remove(SESSION_KEY);
    throw new Error("Connecte-toi d'abord.");
  }
  if (!res.ok) {
    const error = await res.json().catch(() => ({}));
    throw new Error(error.error || "Le partage a échoué.");
  }
}

// The "BoredBoard" button injected in the players: keep the track for the
// popup, then open it. Browsers may refuse to open it without a click on the
// toolbar icon; the page then asks for that click.
async function shareFromPage(track) {
  await chrome.storage.local.set({ pendingTrack: { track, savedAt: Date.now() } });
  try {
    await chrome.action.openPopup();
    return { opened: true };
  } catch {
    return { opened: false };
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handlers = {
    getSession: async () => {
      const session = await getSession();
      return session && { email: session.email };
    },
    login: async () => {
      const session = await auth("password", { email: message.email, password: message.password });
      await chrome.storage.local.set({ [SESSION_KEY]: session });
      return { email: session.email };
    },
    logout: async () => {
      await chrome.storage.local.remove(SESSION_KEY);
      return null;
    },
    share: () => share(message),
    SHARE_TRACK: () => shareFromPage(message.track),
  };
  const handler = handlers[message?.type];
  if (!handler) return false;

  handler()
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => sendResponse({ ok: false, error: error.message }));
  // Keeps the channel open for the asynchronous response.
  return true;
});

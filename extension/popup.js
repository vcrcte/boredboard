// Popup: sign-in form, or the track playing in the active tab with a share button.

const PLATFORM_STYLES = {
  spotify: { label: "Spotify", background: "rgba(30,215,96,0.1)", color: "#1DB954" },
  apple: { label: "Apple Music", background: "rgba(252,60,68,0.1)", color: "#FC3C44" },
  deezer: { label: "Deezer", background: "rgba(239,100,0,0.1)", color: "#EF6400" },
  youtube: { label: "YouTube Music", background: "rgba(255,0,0,0.1)", color: "#FF0000" },
};

const $ = (id) => document.getElementById(id);
let currentTrack = null;

function send(message) {
  return new Promise((resolve) => chrome.runtime.sendMessage(message, resolve));
}

function show(element, visible) {
  element.hidden = !visible;
}

/** The track sent by the in-page button (kept two minutes), else what the active tab plays. */
async function detectTrack() {
  const { pendingTrack } = await chrome.storage.local.get("pendingTrack");
  if (pendingTrack) {
    await chrome.storage.local.remove("pendingTrack");
    if (Date.now() - pendingTrack.savedAt < 120_000) return { track: pendingTrack.track, reason: null };
  }
  return detectActiveTab();
}

/** Asks the content script of the active tab what is playing. */
async function detectActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || !tab.id) return { track: null, reason: "none" };
  try {
    const track = await chrome.tabs.sendMessage(tab.id, { type: "GET_TRACK" });
    return { track, reason: track ? null : "nothing" };
  } catch {
    // No content script: not a supported site, or a tab opened before the extension was installed.
    const supported = /^https:\/\/(open\.spotify\.com|music\.apple\.com|www\.deezer\.com|music\.youtube\.com)\//.test(tab.url || "");
    return { track: null, reason: supported ? "reload" : "none" };
  }
}

function renderTrack({ track, reason }) {
  currentTrack = track;
  show($("track"), Boolean(track));
  $("share-button").disabled = !track;

  if (!track) {
    $("no-track").textContent =
      reason === "reload"
        ? "Recharge cet onglet pour que BoredBoard détecte ta musique."
        : reason === "nothing"
          ? "Aucune musique détectée. Lance un titre ou ouvre un album ou une playlist."
          : "Ouvre Spotify, Apple Music, Deezer ou YouTube Music dans cet onglet.";
    show($("no-track"), true);
    return;
  }

  show($("no-track"), false);
  const style = PLATFORM_STYLES[track.platform];
  $("track-platform").textContent = track.kind === "playlist" ? `${style.label} · Playlist` : track.kind === "album" ? `${style.label} · Album` : style.label;
  $("track-platform").style.background = style.background;
  $("track-platform").style.color = style.color;
  $("track-title").textContent = track.title;
  $("track-artist").textContent = track.artist || "";
  if (track.cover) {
    $("track-cover").src = track.cover;
    show($("track-cover"), true);
    show($("track-cover-placeholder"), false);
  }
}

async function showShareView(email) {
  show($("login-view"), false);
  show($("share-view"), true);
  $("account").textContent = email;
  renderTrack(await detectTrack());
}

function showLoginView() {
  show($("share-view"), false);
  show($("login-view"), true);
}

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  show($("login-error"), false);
  $("login-button").disabled = true;
  const response = await send({ type: "login", email: $("email").value.trim(), password: $("password").value });
  $("login-button").disabled = false;
  if (response && response.ok) {
    $("password").value = "";
    showShareView(response.result.email);
  } else {
    $("login-error").textContent = (response && response.error) || "Connexion impossible.";
    show($("login-error"), true);
  }
});

$("share-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!currentTrack) return;
  show($("share-error"), false);
  show($("share-success"), false);
  $("share-button").disabled = true;
  $("share-button").textContent = "Partage…";

  const response = await send({ type: "share", track: currentTrack, comment: $("comment").value });
  $("share-button").textContent = "Partager sur BoredBoard";

  if (response && response.ok) {
    $("comment").value = "";
    show($("share-success"), true);
    // Leave the button off: one share per click on the icon.
    setTimeout(() => window.close(), 2500);
  } else {
    $("share-button").disabled = false;
    $("share-error").textContent = (response && response.error) || "Le partage a échoué.";
    show($("share-error"), true);
    if (response && /Connecte-toi/.test(response.error || "")) showLoginView();
  }
});

$("logout").addEventListener("click", async () => {
  await send({ type: "logout" });
  showLoginView();
});

$("signup-link").href = `${BOREDBOARD_CONFIG.appUrl}/signup`;
$("dashboard-link").href = `${BOREDBOARD_CONFIG.appUrl}/dashboard`;

send({ type: "getSession" }).then((response) => {
  if (response && response.ok && response.result) showShareView(response.result.email);
  else showLoginView();
});

// Shared by the four platform scripts. Each one calls registerTrackDetector()
// with a function returning what the page is playing; the popup asks for it
// with a GET_TRACK message.

/** The browser's media session, which all four players fill in. */
function mediaSessionTrack() {
  const metadata = navigator.mediaSession && navigator.mediaSession.metadata;
  if (!metadata || !metadata.title) return null;
  const artwork = [...(metadata.artwork || [])].sort((a, b) => parseInt(b.sizes, 10) - parseInt(a.sizes, 10))[0];
  return { title: metadata.title, artist: metadata.artist || "", cover: artwork ? artwork.src : null };
}

function textOf(selector) {
  const element = document.querySelector(selector);
  return element ? element.textContent.trim() : "";
}

function absoluteUrl(href) {
  try {
    return href ? new URL(href, location.href).href : null;
  } catch {
    return null;
  }
}

/** Only https covers are kept (blob: or data: artwork can't be shown on BoredBoard). */
function httpsOrNull(url) {
  return url && url.startsWith("https://") ? url : null;
}

function toast(text) {
  const note = document.createElement("div");
  note.textContent = text;
  note.style.cssText =
    "position:fixed;bottom:96px;right:24px;z-index:2147483647;background:#1C1A15;color:#F7F4EE;font:12px/1.4 system-ui,sans-serif;padding:10px 14px;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,0.25);max-width:280px;";
  document.body.appendChild(note);
  setTimeout(() => note.remove(), 4000);
}

/**
 * Adds a "📤 BoredBoard" button to the player bar (the first of `containers`
 * found), and re-adds it when the single-page app re-renders the bar.
 */
function injectShareButton(platform, containers, detect) {
  let scheduled = false;

  const inject = () => {
    scheduled = false;
    if (document.getElementById("boredboard-btn")) return;
    const bar = containers.map((selector) => document.querySelector(selector)).find(Boolean);
    if (!bar) return;

    const button = document.createElement("button");
    button.id = "boredboard-btn";
    button.type = "button";
    button.textContent = "📤 BoredBoard";
    button.title = "Partager sur BoredBoard";
    button.style.cssText =
      "background:#2A3560;color:#F7F4EE;border:none;border-radius:20px;padding:6px 14px;font:500 11px system-ui,sans-serif;cursor:pointer;margin-left:12px;flex-shrink:0;transition:background 0.2s;";
    button.addEventListener("mouseenter", () => (button.style.background = "#3D4F8C"));
    button.addEventListener("mouseleave", () => (button.style.background = "#2A3560"));
    button.addEventListener("click", async () => {
      let track = null;
      try {
        track = detect();
      } catch {
        // A redesign of the player broke a selector.
      }
      if (!track || !track.title) {
        toast("Aucune musique détectée sur cette page.");
        return;
      }
      const response = await chrome.runtime.sendMessage({
        type: "SHARE_TRACK",
        track: { platform, kind: "track", ...track, cover: httpsOrNull(track.cover), pageUrl: location.href },
      });
      if (!response || !response.ok || !response.result.opened) {
        toast("Clique sur l'icône BoredBoard dans la barre d'outils pour finir le partage.");
      }
    });
    bar.appendChild(button);
  };

  // The players re-render constantly: coalesce the checks into one per frame.
  new MutationObserver(() => {
    if (!scheduled) {
      scheduled = true;
      requestAnimationFrame(inject);
    }
  }).observe(document.body, { childList: true, subtree: true });
  inject();
}

function registerTrackDetector(platform, detect, buttonContainers) {
  if (buttonContainers) injectShareButton(platform, buttonContainers, detect);
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (!message || message.type !== "GET_TRACK") return false;
    let track = null;
    try {
      track = detect();
    } catch {
      // A redesign of the player broke a selector: report nothing rather than throw.
    }
    sendResponse(
      track && track.title
        ? { platform, kind: "track", ...track, cover: httpsOrNull(track.cover), pageUrl: location.href }
        : null,
    );
    return false;
  });
}

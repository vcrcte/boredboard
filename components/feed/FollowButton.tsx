"use client";

import { useState } from "react";
import { follow, unfollow } from "@/lib/social";

/** Small Suivre / Abonné toggle used on feed entries and suggestions. */
export default function FollowButton({
  viewerId,
  targetId,
  initial = false,
  onChange,
  colors,
}: {
  viewerId: string;
  targetId: string;
  initial?: boolean;
  onChange?: (following: boolean) => void;
  colors: { primary: string; onPrimary: string; line: string; muted: string };
}) {
  const [following, setFollowing] = useState(initial);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    setBusy(true);
    const next = !following;
    const ok = next ? await follow(viewerId, targetId) : await unfollow(viewerId, targetId);
    if (ok) {
      setFollowing(next);
      onChange?.(next);
    }
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      style={{
        fontSize: 12,
        fontWeight: 600,
        padding: "6px 14px",
        borderRadius: 20,
        cursor: "pointer",
        opacity: busy ? 0.6 : 1,
        whiteSpace: "nowrap",
        ...(following
          ? { background: "transparent", color: colors.muted, border: `1px solid ${colors.line}` }
          : { background: colors.primary, color: colors.onPrimary, border: "none" }),
      }}
    >
      {following ? "Abonné" : "Suivre"}
    </button>
  );
}

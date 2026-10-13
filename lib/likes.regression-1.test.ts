// Regression: ISSUE-001 — dashboard counts the viewer's own like twice once likes_count is kept by the trigger
// Found by /qa on 2026-10-13
// Report: .gstack/qa-reports/qa-report-localhost-2026-10-13.md
import { describe, expect, it } from "vitest";
import { displayedLikes } from "./likes";

describe("displayedLikes", () => {
  it("does not count the viewer's saved like twice", () => {
    // likes_count already includes the viewer's like (trigger + backfill).
    expect(displayedLikes(1, true, true)).toBe(1);
  });

  it("drops to the other likes when the viewer unlikes", () => {
    expect(displayedLikes(3, true, false)).toBe(2);
  });

  it("adds a new like on top of the others", () => {
    expect(displayedLikes(2, false, true)).toBe(3);
  });

  it("never shows a negative count while likes_count is still stale", () => {
    // Before the migration runs, likes_count is 0 even though the viewer liked.
    expect(displayedLikes(0, true, true)).toBe(1);
    expect(displayedLikes(0, true, false)).toBe(0);
  });
});

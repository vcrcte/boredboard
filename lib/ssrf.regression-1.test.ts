// Regression: /review D2 — link-preview private-address check missed IPv6 ranges that reach private hosts
// Found by /review on 2026-10-13
import { describe, expect, it } from "vitest";
import { isPrivateAddress } from "./ssrf";

describe("isPrivateAddress", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "::",
    "::ffff:127.0.0.1",
    "fd00::1",
    "fe80::1",
    // Gaps found in review:
    "febf::1", // still link-local (fe80::/10)
    "::ffff:7f00:1", // IPv4-mapped 127.0.0.1 in hex form
    "64:ff9b::7f00:1", // NAT64 embedding 127.0.0.1
    "2002:7f00:1::", // 6to4 embedding 127.0.0.1
  ])("blocks %s", (address) => {
    expect(isPrivateAddress(address)).toBe(true);
  });

  it.each(["93.184.216.34", "1.1.1.1", "2606:4700:4700::1111", "64:ff9b::808:808", "2002:808:808::"])(
    "allows public %s",
    (address) => {
      expect(isPrivateAddress(address)).toBe(false);
    },
  );
});

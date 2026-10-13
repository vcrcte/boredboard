import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { isIP, type LookupFunction } from "node:net";

function isPrivateIPv4(address: string): boolean {
  const [x, y] = address.split(".").map(Number);
  return (
    x === 0 ||
    x === 10 ||
    x === 127 ||
    (x === 100 && y >= 64 && y <= 127) ||
    (x === 169 && y === 254) ||
    (x === 172 && y >= 16 && y <= 31) ||
    (x === 192 && y === 168) ||
    x >= 224
  );
}

/** Expands an IPv6 address to its 8 hextets (handles "::" and a trailing dotted IPv4). */
function ipv6Hextets(address: string): number[] {
  let text = address.toLowerCase().split("%")[0];
  const dotted = /(\d+\.\d+\.\d+\.\d+)$/.exec(text);
  if (dotted) {
    const [a, b, c, d] = dotted[1].split(".").map(Number);
    text = text.slice(0, -dotted[1].length) + `${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = text.split("::");
  const parse = (part: string | undefined) => (part ? part.split(":").map((h) => parseInt(h, 16)) : []);
  const left = parse(head);
  const right = parse(tail);
  const zeros = tail === undefined ? 0 : 8 - left.length - right.length;
  return [...left, ...Array(zeros).fill(0), ...right];
}

const ipv4FromHextets = (high: number, low: number) => `${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`;

/** True for loopback, private, link-local, CGNAT, multicast and other non-public ranges. */
export function isPrivateAddress(address: string): boolean {
  if (isIP(address) !== 6) return isPrivateIPv4(address);
  const h = ipv6Hextets(address);
  const first96Zero = h.slice(0, 6).every((x) => x === 0);
  if (first96Zero) return h[6] === 0 && h[7] <= 1 ? true : isPrivateIPv4(ipv4FromHextets(h[6], h[7])); // ::, ::1, ::a.b.c.d
  if (h.slice(0, 5).every((x) => x === 0) && h[5] === 0xffff) return isPrivateIPv4(ipv4FromHextets(h[6], h[7])); // ::ffff:a.b.c.d
  if (h[0] === 0x64 && h[1] === 0xff9b && h.slice(2, 6).every((x) => x === 0)) return isPrivateIPv4(ipv4FromHextets(h[6], h[7])); // NAT64
  if (h[0] === 0x2002) return isPrivateIPv4(ipv4FromHextets(h[1], h[2])); // 6to4
  return (h[0] & 0xfe00) === 0xfc00 || (h[0] & 0xffc0) === 0xfe80 || (h[0] & 0xff00) === 0xff00; // ULA, link-local, multicast
}

/**
 * DNS lookup for outgoing requests that refuses non-public addresses. Used as the
 * socket's `lookup`, so the address checked is the one actually connected to:
 * a hostname cannot resolve to a public IP for the check and a private one for the connection.
 */
export const publicOnlyLookup: LookupFunction = (hostname, options, callback) => {
  dnsLookup(hostname, { ...options, all: true }, (error, addresses: LookupAddress[]) => {
    if (error) return callback(error, "", 0);
    if (addresses.length === 0 || addresses.some((a) => isPrivateAddress(a.address))) {
      return callback(Object.assign(new Error(`Blocked non-public address for ${hostname}`), { code: "EPRIVATE" }), "", 0);
    }
    if (options.all) return (callback as unknown as (e: null, a: LookupAddress[]) => void)(null, addresses);
    callback(null, addresses[0].address, addresses[0].family);
  });
};

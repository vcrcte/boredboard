import { GET as lastfm } from "../lastfm/route";

// The listener's most played tracks over the last seven days.
export async function GET(request: Request) {
  const url = new URL(request.url);
  url.searchParams.set("method", "user.gettoptracks");
  url.searchParams.set("period", "7day");
  return lastfm(new Request(url));
}

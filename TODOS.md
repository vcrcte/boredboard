# TODOS

Parked sections come from the 2026-10-13 CEO review (SCOPE REDUCTION): boredboard's core is the social board for curious people (posts, feed, profiles, follows, explore, sharing via extension and iOS Shortcut). "Parked" means removed from navigation and the dashboard, code and Supabase tables kept, no new work.

**Revisit trigger for every parked section:** the social core has 20+ weekly active users, or a user asks for the section by name.

## Infrastructure

### Usage analytics and error tracking

**What:** Add Vercel Analytics (page views, share events) and server-side error logging on `/api/feed`, `/api/shortcuts/music` and `/api/posts/music`.

**Why:** Nothing today tells whether anyone opens the board, shares a track or hits an error. After the scope reduction, "is the core used?" is the question that decides what to build next.

**Context:** No analytics or error tracking in `package.json` as of 2026-10-13. Supabase showed 1 profile and 11 posts to an anonymous query (RLS may hide rows), last post 2026-10-06.

**Effort:** S
**Priority:** P2
**Depends on:** None

## Universal share link (2026-10-13)

### Chrome extension: copy the universal link (Low)

**What:** Make the extension (extension/background.js → app/api/posts/music) return and copy `/s/<post id>` like the iOS Shortcut.

**Why:** Deferred in the eng review (D4): 90% of curators share from iPhone; desktop shares keep working but don't get a universal link.

**Context:** Universal link plan in docs/designs/first-20-users.md; capture contract in app/api/shortcuts/music/route.ts after task U4.

**Effort:** S
**Priority:** P3
**Depends on:** U4 (shortcut route returns share_url)

## QA (2026-10-13)

### Run the 2026-10-04 migration in Supabase (Medium, console/functional)

**What:** Run `lib/migrations/2026-10-04-dashboard-social.sql` in the Supabase SQL editor.

**Why:** Production has no `profiles.preferences` or `profiles.lastfm_username`: every page logs 400s on `/rest/v1/profiles`, dashboard preferences are only saved on the device, and Last.fm features fail.

**Context:** Found by /qa on localhost:3000 (dashboard, profile, settings). Repro: open /dashboard signed in, check the console for `400` on `profiles?select=preferences`.

**Effort:** S
**Priority:** P1
**Depends on:** None

### Tendances count does not match the posts (Low, content)

**What:** "#Musique 17 posts" in the dashboard's Tendances while the profile shows 9 music posts.

**Why:** Misleading numbers on the main screen.

**Context:** Found by /qa. Repro: /dashboard right column vs /profile counters.

**Effort:** S
**Priority:** P3
**Depends on:** None

### "Mes thèmes" no longer filters anything (Low, UX)

**What:** Remove or repurpose the themes section (customizer + dashboard sidebar).

**Why:** It says "Le contenu sera filtré selon tes centres d'intérêt", but themes only filtered the news, which is parked.

**Context:** components/dashboard/Customizer.tsx (Mes thèmes), app/dashboard/page.tsx sidebar.

**Effort:** S
**Priority:** P3
**Depends on:** None

### Profile comment counts are always 0 (Low, content)

**What:** Pass the real comment count instead of `comments={0}` in app/profile/page.tsx.

**Why:** Comments exist but the profile shows 0.

**Context:** Found by /qa. Needs the interactions read policy (lib/migrations/2026-10-13-likes-and-interactions.sql) to count other people's comments.

**Effort:** S
**Priority:** P3
**Depends on:** 2026-10-13 likes and interactions migration

## Parked sections

### Markets (portfolio, price alerts, market data)

**What:** Unpark the markets dashboard if the revisit trigger fires.

**Why:** Parked as the furthest from the social core and the largest component to maintain.

**Context:** `components/MarketsDashboard.tsx` (1,434 lines, rendered in `app/actualites`), `app/api/markets/*`, `lib/markets.ts`, `lib/user-markets.ts`, tables `user_portfolio` and `user_price_alerts` (`lib/schema-markets.sql`).

**Effort:** S
**Priority:** P4
**Depends on:** Revisit trigger

### News (Actualités)

**What:** Unpark news if the revisit trigger fires, ideally as a source users share from rather than a feed of its own.

**Why:** Parked as commodity content with an external quota (NewsData, 200 requests/day) that already broke production once.

**Context:** `app/actualites`, `app/api/news` (Supabase cache, `NEWSDATA_API_KEY` on Vercel), `lib/news.ts`, dashboard module via `useNews` in `app/dashboard/page.tsx`.

**Effort:** S
**Priority:** P4
**Depends on:** Revisit trigger

### Culture (Wikipedia + Open Library)

**What:** Unpark culture if the revisit trigger fires, possibly as a share source.

**Why:** Parked as reading material outside the share-and-follow loop.

**Context:** `app/culture`, `app/api/culture` (+ `culture/feed`), `increment_views` RPC.

**Effort:** S
**Priority:** P4
**Depends on:** Revisit trigger

### Podcasts

**What:** Unpark podcasts if the revisit trigger fires.

**Why:** Parked: already missing from the main navbar and duplicates podcast apps.

**Context:** `app/podcasts`, `lib/podcasts.ts`, table `podcast_subscriptions` (`migration-podcast-subscriptions.sql`).

**Effort:** S
**Priority:** P4
**Depends on:** Revisit trigger

### Séries & Vidéos

**What:** Unpark the series and videos catalogue if the revisit trigger fires.

**Why:** Parked: a static catalogue that needs manual curation, already moved out of the main navbar.

**Context:** `app/series` (565 lines), `app/videos` (redirect to `/series`), `lib/series.ts`, `lib/videos.ts`; linked from the dashboard nav.

**Effort:** S
**Priority:** P4
**Depends on:** Revisit trigger

### Newsletters

**What:** Unpark newsletters if the revisit trigger fires.

**Why:** Parked: duplicates the email inbox and sits outside the social core.

**Context:** `app/newsletter` (473 lines), `app/api/newsletters`, `lib/newsletter.ts`, table `newsletter_subscriptions`; linked from the dashboard.

**Effort:** S
**Priority:** P4
**Depends on:** Revisit trigger

### Forum

**What:** Unpark the forum once the community is large enough that posts and replies are not enough.

**Why:** Parked: overlaps posts, and two places to talk split a small community (0 topics as of 2026-10-13).

**Context:** `app/forum` (701 lines), `lib/forum.ts`, tables `forum_posts` and `forum_replies` (created from `forum.sql` with a reply-count trigger).

**Effort:** S
**Priority:** P4
**Depends on:** Revisit trigger

## Completed

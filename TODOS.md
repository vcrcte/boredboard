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

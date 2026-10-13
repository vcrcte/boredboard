---
# gstack: design-md-format=spec
name: boredboard
description: Friends' shelves — calm, object-led and personal; the things people share supply the color, the interface stays quiet.
colors:
  ground: "#ECEEEA"
  surface: "#FAFAF8"
  text: "#15171A"
  text-muted: "#5D6168"
  primary: "#2A3560"
  primary-hover: "#1F2849"
  on-primary: "#FAFAF8"
  presence: "#E0457B"
  success: "#2F7D5B"
  warning: "#A86A12"
  error: "#B4302F"
  info: "#2A3560"
  line: "rgba(21, 23, 26, 0.10)"
  dark-ground: "#121A3A"
  dark-surface: "#1B2450"
  dark-text: "#E6E8E3"
  dark-text-muted: "#A3A8B8"
  dark-primary: "#8E9BE0"
  dark-primary-hover: "#A9B3EA"
  dark-on-primary: "#121A3A"
  dark-presence: "#F06A96"
  dark-success: "#6FC39A"
  dark-warning: "#E2A64B"
  dark-error: "#EF7A78"
typography:
  display:
    fontFamily: Cabinet Grotesk
    fontWeight: 800
    fontSize: clamp(2.2rem, 5.2vw, 4.4rem)
    letterSpacing: -0.03em
  heading:
    fontFamily: Cabinet Grotesk
    fontWeight: 800
    fontSize: 34px
    letterSpacing: -0.02em
  body:
    fontFamily: Satoshi
    fontSize: 1rem
    lineHeight: 1.5
  label:
    fontFamily: Satoshi
    fontWeight: 500
    fontSize: 13px
  reading:
    fontFamily: Literata
    fontWeight: 400
    fontSize: 18px
    lineHeight: 1.55
  mono:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontFeature: tnum
rounded:
  sm: 3px
  md: 4px
  lg: 6px
  full: 9999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  2xl: 48px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.lg}"
  button-primary-hover:
    backgroundColor: "{colors.primary-hover}"
  button-secondary:
    backgroundColor: transparent
    textColor: "{colors.text}"
    borderColor: "{colors.line}"
    rounded: "{rounded.lg}"
  input:
    backgroundColor: "{colors.surface}"
    borderColor: "{colors.line}"
    rounded: "{rounded.md}"
  post:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
  sleeve:
    rounded: "{rounded.sm}"
  nav-link:
    textColor: "{colors.text-muted}"
---

# boredboard

## Overview

**Creative North Star:** a friend's shelves. You open boredboard and see the record sleeves, book jackets and clippings of the curious people you follow, before you see any interface.
**Product context:** French social board "pour les esprits curieux": people share music (Chrome extension, iOS Shortcut), articles, books and short reflections, follow each other and react. Peers: Are.na, Cosmos, Letterboxd, Literal. Web app (Next.js) with a public landing page and a signed-in dashboard.
**Memorable thing:** "my curious friends' taste" — every decision should make a person's taste readable at a glance.
**Mode per surface:**
- Landing: Persuade.
- Dashboard / Board: Operate + Read.
- Profile (a person's shelf): Read.
- Explore: Operate.
**Reference sites:** https://www.are.na and https://www.cosmos.so (screenshots, 2026-10-13); Letterboxd (web search only; blocked a headless browser).
**Key characteristics:**
- Covers and sleeves carry the color; the chrome is one ink, one indigo, one rose.
- The unit is the person: the dashboard opens on one shelf per friend, not a stream of posts.
- Likes are marks (friends' avatars and a rose heart), not numbers.
- People's words are set in a reading serif; the interface speaks in a sans.

## Colors

**Strategy:** Restrained. Neutrals plus one action color (indigo) and one presence color (rose). The shared objects are the color; the UI never competes with them.
**Light or dark:** light by default (a phone or laptop during the day), with an evening mode that follows the system setting, for the "listening at night" scene. Evening mode is midnight blue, never black, and has no glows.

- `primary` (indigo) is for actions and links only: buttons, "Son étagère", focus rings. It continues boredboard's existing identity.
- `presence` (rose) is reserved for likes, reactions and the like mark. Never use it for text under 16px (contrast about 3.6:1 on white).
- `ground` is a cool concrete grey, deliberately not cream. Surfaces sit one step lighter and hold posts and written content.
- Evening mode raises indigo to `dark-primary`, so actions stay legible on midnight blue. Surfaces stay one step lighter than the ground, which keeps the hierarchy instead of simply inverting it.
- Semantic colors (success, warning, error, info) appear as tinted message backgrounds (10% of the color over the surface) with the color applied only to the leading word.

## Typography

Four faces, each with one job:
- **Cabinet Grotesk 800** (Fontshare, ITF Free Font License): person names, page and section titles, the landing headline. Set tight (letter-spacing -0.02 to -0.03em). Never used for paragraphs.
- **Satoshi 400/500/700** (Fontshare, ITF Free Font License): all interface text, captions, metadata, buttons. Sentence case; no tracked capitals.
- **Literata 400** (Google Fonts, OFL), 18px / 1.55: only what people wrote (reflections, comments, quotes on clippings). This separates the people's voice from the app's voice.
- **JetBrains Mono** (Google Fonts, OFL) with tabular figures: durations, read times, timestamps, counts.

Loading:
- `https://api.fontshare.com/v2/css?f[]=cabinet-grotesk@500,800&f[]=satoshi@400,500,700&display=swap`
- `https://fonts.googleapis.com/css2?family=Literata:ital,opsz,wght@0,7..72,400;1,7..72,400&family=JetBrains+Mono:wght@400;500&display=swap`

Use `font-display: swap`. Heading levels differ by size, not just weight: display clamp(2.2rem, 5.2vw, 4.4rem), shelf headings 34px, section headings 22-30px, body 16px, captions 13px.

## Layout

- Max content width 1180px. Side gutters 16px on phones, 32px from 760px up.
- The dashboard is a vertical stack of **shelves** (one per followed person). Each has a 34px name, a short meta line ("8 choses cette semaine") and a "Son étagère" link, followed by a horizontal row of objects that scrolls and snaps on small screens. A detailed feed of posts follows the shelves, at 640px max width, with a side column from 900px up.
- Objects keep their real proportions: square sleeves (168px), 2:3 books (112px wide), clippings and notes about 190-200px wide.
- Shelves are separated by a single hairline (`line`), not by cards.
- The landing page is editorial: a headline of up to 15 characters per line on the left, then a real shelf of covers. No 3-column feature grid.

## Elevation & Depth

Objects sit on the shelf with a soft, offset shadow (`0 1px 2px` plus `0 6px 16px` at 8% ink), like real things on a surface. Books get a 5px darker spine edge on the left. Posts use the same shadow on `surface`. No zero-offset glows; no frosted glass.

## Shapes

- Sleeves: 3px radius.
- Books: 2px on the spine side, 4px on the open side.
- Inputs: 4px.
- Buttons, posts and messages: 6px.
- Avatars and marks: full circle.

No large uniform radius anywhere: objects should feel like objects, not app tiles.

## Components

- **Shelf object:** sleeve, book, clipping (source, title, read time in mono) or note (Literata). The caption sits under it: title in Satoshi 500, artist or author in muted text. Hover lifts the shadow slightly. Focus-visible shows a 2px indigo outline with a 2px offset.
- **Marks:** up to 3 overlapping 24px friend avatars plus a rose heart, anchored to the bottom-right corner of an object. On posts, show the marks followed by names ("Camille, Léa et toi"). An exact count can appear on hover or long-press.
- **Post:** surface background, a header row (avatar, bold name, action verb in muted text, mono timestamp), Literata body, an actions row (marks, Répondre), and comments separated by a hairline.
- **Buttons:**
  - Primary: indigo, hover darkens.
  - Secondary: transparent with a hairline border.
  - Ghost: indigo text.
  - Like: rose text with a rose border at 35%.
  - Disabled: 45% opacity.
- **Inputs:** muted 13px label above the field, surface background, hairline border. Error text sits below in `error` 13px and says what is wrong ("Cette adresse n'est pas complète.").
- **Empty states:** state what's missing and offer the two next actions ("Partager un morceau", "Explorer"). Never leave a blank shelf or feed.

## Do's and Don'ts

- Do let covers and sleeves be the only saturated color on screen.
- Do lead every person-centered view with the person's name in Cabinet Grotesk.
- Do set user-written text in Literata and interface text in Satoshi; never swap them.
- Do show who reacted (marks) before how many.
- Do design the empty, loading and error state of every shelf and post.
- Don't put cream backgrounds, gradients, glows or decorative blobs anywhere.
- Don't wrap shelves or objects in cards, and never nest cards.
- Don't use emoji as icons or section decoration (the rose ♥ mark is the one glyph).
- Don't use rose for buttons or links; it means "someone was here".
- Don't center blocks of text; left-align, with the landing headline included.

## Motion

- **Approach:** minimal-functional.
- **Easing:** enter ease-out, exit ease-in, move ease-in-out.
- **Duration:**
  - micro: 50-100ms (hover, press)
  - short: 150-250ms (marks appearing, menus)
  - medium: 250-400ms (shelf scroll snap)
  - long: 400-700ms (reserved for the authored moment)
- **The one authored moment:** when you share something, its sleeve or cover slides onto the start of your own shelf (about 500ms, ease-out). That's the only choreographed motion in the product. Respect `prefers-reduced-motion` and fade instead.

## Decisions Log

| Date | Decision | Rationale |
|------|----------|-----------|
| 2026-10-13 | Initial design system created | /design-consultation from the product brief (social board core, memorable thing "my curious friends' taste"), research on Are.na, Cosmos and Letterboxd, and an independent Claude subagent proposal |
| 2026-10-13 | Shelves of people as the dashboard's first view | Both independent proposals reached it; taste is readable per person, which is the product |
| 2026-10-13 | Cool concrete ground instead of cream | Breaks from the cream + serif default and from the reverted v2; lets covers carry the color |
| 2026-10-13 | Marks instead of like counts | Calm, personal and present even while the community is small; the count stays available on hover |
| 2026-10-13 | Risograph effects rejected | Charming, but busy; the reason the v2 overhaul was reverted is unknown, so decoration stays restrained |

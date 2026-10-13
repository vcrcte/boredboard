## gstack (recommended)

This project uses [gstack](https://github.com/garrytan/gstack) for AI-assisted workflows.
Install it for the best experience:

```bash
git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
cd ~/.claude/skills/gstack && ./setup --team
```

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.
Use `~/.claude/skills/gstack/...` for gstack file paths.

Available skills:

- Planning: `/office-hours`, `/plan-ceo-review`, `/plan-eng-review`, `/plan-design-review`, `/autoplan`
- Design: `/design-consultation`, `/design-review`
- Review & shipping: `/review`, `/ship`, `/land-and-deploy`, `/canary`, `/benchmark`, `/document-release`, `/retro`
- Browser & QA: `/browse`, `/qa`, `/qa-only`, `/setup-browser-cookies`, `/setup-deploy`
- Debugging & security: `/investigate`, `/cso`, `/codex`
- Safety: `/careful`, `/freeze`, `/guard`, `/unfreeze`
- Maintenance: `/gstack-upgrade`

## Testing

- Run tests: `npm test` (Vitest, `vitest run`). Tests live next to the code as `*.test.ts` (e.g. `lib/feed-algorithm.test.ts`).
- CI (`.github/workflows/check.yml`) runs `npm run lint`, `npx tsc --noEmit` and `npm test` on every push to main.

## Skill routing

When the user's request matches an available skill, invoke it via the Skill tool. Route only to skills in the session's available-skills list; answer directly for quick questions or small scoped edits.

Key routing rules:
- Product ideas/brainstorming → invoke /office-hours
- Strategy/scope → invoke /plan-ceo-review
- Architecture → invoke /plan-eng-review
- Design system/plan review → invoke /design-consultation or /plan-design-review
- Full review pipeline → invoke /autoplan
- Bugs/errors → invoke /investigate
- QA/testing site behavior → invoke /qa or /qa-only
- Code review/diff check → invoke /review
- Visual polish → invoke /design-review
- Ship/deploy/PR → invoke /ship or /land-and-deploy
- Save progress → invoke /context-save
- Resume context → invoke /context-restore
- Author a backlog-ready spec/issue → invoke /spec

## Design System
Read DESIGN.md before visual or UI work: it defines the fonts, colors, spacing, and
aesthetic direction. Ask the user before departing from it. When reviewing or QA-ing
UI, flag code that doesn't match DESIGN.md.

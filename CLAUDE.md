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

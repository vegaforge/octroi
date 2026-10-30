---
date: 2026-10-29
feature: AI governance rulebook, five-gate preflight, lefthook hooks and a quality CI check
scope: chore
issue: none
scenario-impact: none
---

# AI governance and preflight

Nothing changes for publishers or crawlers. This release changes how Octroi is built.

For contributors:

- `AGENTS.md` is the rulebook for AI coding agents, with the engineering standards in
  `.claude/skills/octroi-engineering-standards/SKILL.md`. Decisions follow
  [ADR-2026-10-29-ai-governance](../adr/ADR-2026-10-29-ai-governance.md).
- `./scripts/preflight.sh` runs the five gates (format, lint, typecheck, tests, build)
  for the TypeScript workspace and the Go gateway. `--fast` skips the build.
- Git hooks moved from Husky and lint-staged to lefthook. Run
  `git config --unset core.hooksPath` once in an existing clone, then `pnpm install`.
- CI runs `checks`, `tests` and `build` in parallel, and `quality` reports the result.
  CI now builds the dashboard and requires a release note for application code changes.
- The PR template is now `.github/pull_request_template.md` with a payment-path
  checklist. `.nvmrc` pins Node 20.

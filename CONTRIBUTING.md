# Contributing to Octroi

Thanks for your interest in Octroi. This document covers how the project is developed and the conventions every change is expected to follow.

## Ground rules

- **Every pull request resolves a tracked issue.** Before opening a PR, make sure an issue exists describing the work, and reference it in the PR (`Closes #123`). If you find a bug, **open an issue first**, then fix it. The issue is the record of what was wrong and why.
- **Verify each step.** Run `pnpm typecheck` and `pnpm test` for anything you touch before pushing. Don't build forward on an unverified change.
- **Build robust, not porous.** Validate inputs at boundaries, enforce invariants (replay protection, amount ceilings, recipient checks), and prefer code that can't be broken over code that's quick.
- **Comments read like the code around them.** Match the surrounding density and idiom. No filler, no narration, no machine-generated tone.

## Development setup

Requirements: Node 20+, pnpm 9, Docker (for local Postgres + Redis).

```bash
pnpm install
cp .env.example .env        # fill in the Stellar settings
pnpm infra:up               # Postgres + Redis
pnpm migrate                # apply the schema
pnpm lint                   # ESLint with typed rules, zero warnings allowed
pnpm typecheck              # tsc --noEmit across the workspace
pnpm test                   # Vitest across packages with tests
```

The monorepo is managed with pnpm workspaces and Turbo. Run a single package's scripts with `pnpm --filter @octroi/<name> <script>`.

## Branches and commits

- Branch off `main`: `feat/<short-name>`, `fix/<short-name>`, or `docs/<short-name>`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`, e.g. `feat(facilitator): submit USDC SAC transfer`. Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `style`.
- A `commit-msg` hook (commitlint) enforces the format, and a `pre-commit` hook (lint-staged) runs Prettier on staged files. Install hooks with `pnpm install` (Husky sets them up automatically). ESLint is not in the commit hook yet; run `pnpm lint` before you push.

## Pull requests

1. Keep PRs focused on one issue and one logical change.
2. Fill in the PR template and link the issue.
3. CI must pass: formatting, lint, typecheck and tests.
4. A maintainer reviews and merges.

## Code style

- TypeScript strict mode. No `any`: ESLint rejects it (`@typescript-eslint/no-explicit-any`). Parse untrusted JSON into `unknown` and narrow it.
- Formatting is Prettier (`pnpm prettier --write .`); don't hand-format.
- Keep network-specific code in bounded layers, with one enforcement core behind thin adapters (see [`docs/PRD.md` §7](./docs/PRD.md)).

## Where to start

Look for issues labeled [`good first issue`](https://github.com/vegaforge/octroi/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22). The current focus is the v0 Stellar settlement track; see the [`v0` milestone](https://github.com/vegaforge/octroi/milestones).

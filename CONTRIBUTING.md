# Contributing to Octroi

Thanks for your interest in Octroi. This document covers how the project is developed and the conventions every change is expected to follow.

## Ground rules

- **Every pull request resolves a tracked issue.** Before opening a PR, make sure an issue exists describing the work, and reference it in the PR (`Closes #123`). If you find a bug, **open an issue first**, then fix it. The issue is the record of what was wrong and why.
- **Verify each step.** Run `pnpm typecheck` and `pnpm test` for anything you touch before pushing. Don't build forward on an unverified change.
- **Build robust, not porous.** Validate inputs at boundaries, enforce invariants (replay protection, amount ceilings, recipient checks), and prefer code that can't be broken over code that's quick.
- **Comments read like the code around them.** Match the surrounding density and idiom. No filler, no narration, no machine-generated tone.

## Development setup

Requirements: Node 20+, pnpm 9, Go 1.25 (for `apps/api-gateway`), Docker (for local Postgres + Redis).

```bash
pnpm install
cp .env.example .env        # fill in the Stellar settings
pnpm infra:up               # Postgres + Redis
pnpm migrate                # apply the schema
pnpm typecheck              # tsc --noEmit across the workspace
pnpm test                   # Vitest across packages with tests
```

The API gateway is a separate Go module. From `apps/api-gateway`:

```bash
gofmt -l .                  # must print nothing
go vet ./...
go build ./...
go test ./...
```

The monorepo is managed with pnpm workspaces and Turbo. Run a single package's scripts with `pnpm --filter @octroi/<name> <script>`.

## Branches and commits

- Branch off `main`: `feat/<short-name>`, `fix/<short-name>`, or `docs/<short-name>`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`, e.g. `feat(facilitator): submit USDC SAC transfer`. Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `style`.
- A `commit-msg` hook (commitlint) enforces the format, and a `pre-commit` hook (lint-staged) runs Prettier on staged files. There is no ESLint yet ([#38](https://github.com/vegaforge/octroi/issues/38)), and Go files are not formatted by a hook, so run `gofmt` yourself. Install hooks with `pnpm install` (Husky sets them up automatically).

## Pull requests

1. Keep PRs focused on one issue and one logical change.
2. Fill in the PR template and link the issue.
3. CI must pass: Prettier, typecheck and Vitest for the TypeScript workspace, and gofmt, `go vet`, `go build` and `go test` for the gateway.
4. A maintainer reviews and merges.

## Code style

- TypeScript strict mode. No `any` without a justified comment.
- Formatting is Prettier (`pnpm prettier --write .`); don't hand-format.
- Keep network-specific code in bounded layers, with one enforcement core behind thin adapters (see [`docs/PRD.md` §7](./docs/PRD.md)).

## Where to start

Look for issues labeled [`good first issue`](https://github.com/vegaforge/octroi/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22). The current focus is the v0 Stellar settlement track; see the [`v0` milestone](https://github.com/vegaforge/octroi/milestones).

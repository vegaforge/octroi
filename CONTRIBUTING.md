# Contributing to Octroi

Thanks for your interest in Octroi. This document covers how the project is developed and the conventions every change is expected to follow.

AI coding agents follow [`AGENTS.md`](./AGENTS.md), which holds the full rulebook, and the engineering standards in [`.claude/skills/octroi-engineering-standards/SKILL.md`](./.claude/skills/octroi-engineering-standards/SKILL.md). Human contributors are held to the same gates.

## Ground rules

- **Every pull request resolves a tracked issue.** Before opening a PR, make sure an issue exists describing the work, and reference it in the PR (`Closes #123`). If you find a bug, **open an issue first**, then fix it. The issue is the record of what was wrong and why.
- **Verify each step.** Run `./scripts/preflight.sh` before you open a pull request. Don't build forward on an unverified change.
- **Build robust, not porous.** Validate inputs at boundaries, enforce invariants (replay protection, amount ceilings, recipient checks), and prefer code that can't be broken over code that's quick.
- **Comments read like the code around them.** Match the surrounding density and idiom. No filler, no narration, no machine-generated tone.

## Development setup

Requirements: Node 20 (see `.nvmrc`), pnpm 9, Go 1.25 (for `apps/api-gateway`), Docker (for local Postgres + Redis).

```bash
pnpm install                # also installs the git hooks
cp .env.example .env        # fill in the Stellar settings
pnpm infra:up               # Postgres + Redis
pnpm migrate                # apply the schema
pnpm lint                   # ESLint with typed rules, zero warnings allowed
pnpm typecheck              # tsc --noEmit across the workspace
pnpm test                   # Vitest across packages with tests
```

The monorepo is managed with pnpm workspaces and Turbo. Run a single package's scripts with `pnpm --filter @octroi/<name> <script>`. The Go gateway is a separate module: run its commands from `apps/api-gateway`.

## Preflight

`./scripts/preflight.sh` runs the same five gates as CI, for both TypeScript and Go:

| Gate      | TypeScript                 | Go (`apps/api-gateway`)     |
| --------- | -------------------------- | --------------------------- |
| Format    | `pnpm format:check`        | `gofmt -l .` prints nothing |
| Lint      | `pnpm lint` (ESLint)       | `go vet ./...`              |
| Typecheck | `pnpm turbo run typecheck` |                             |
| Tests     | `pnpm test`                | `go test ./...`             |
| Build     | `pnpm build`               | `go build ./...`            |

`./scripts/preflight.sh --fast` skips the build. Set `GO_RACE=true` to run the Go tests with the race detector, as CI does.

## Branches and commits

- Branch off `main`: `feat/<short-name>`, `fix/<short-name>`, `chore/<short-name>`, or `docs/<short-name>`.
- Commits follow [Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`, e.g. `feat(facilitator): submit USDC SAC transfer`. Allowed types: `feat`, `fix`, `docs`, `refactor`, `test`, `chore`, `ci`, `build`, `perf`, `style`.
- Git hooks are managed by [lefthook](https://lefthook.dev) (`lefthook.yml`) and installed by `pnpm install`:
  - `pre-commit` formats staged files with Prettier, and staged Go files with gofmt.
  - `commit-msg` runs commitlint, which enforces the format above.
  - `pre-push` runs `./scripts/preflight.sh --fast`.
- If your clone was set up when the repo used Husky, `pnpm install` stops with a lefthook message about `core.hooksPath`. Run `git config --unset core.hooksPath` once, then `pnpm install` again.

## Pull requests

1. Keep PRs focused on one issue and one logical change.
2. Fill in the PR template and link the issue.
3. If the change touches code under `apps/` or `packages/`, add a release note in `docs/release-notes/` (copy `TEMPLATE.md`).
4. CI must pass. The `quality` check aggregates format, lint, typecheck, tests, build, and the release-note gate.
5. A maintainer reviews and merges.

## Code style

- TypeScript strict mode. No `any`: ESLint rejects it (`@typescript-eslint/no-explicit-any`). Parse untrusted JSON into `unknown` and narrow it.
- Formatting is Prettier (`pnpm prettier --write .`); don't hand-format.
- Keep network-specific code in bounded layers, with one enforcement core behind thin adapters (see [`docs/PRD.md` §7](./docs/PRD.md)).

## Where to start

Look for issues labeled [`good first issue`](https://github.com/vegaforge/octroi/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22). The current focus is the v0 Stellar settlement track; see the [`v0` milestone](https://github.com/vegaforge/octroi/milestones).

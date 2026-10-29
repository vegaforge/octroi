# Engineering Standards and AI Governance Rulebook

All AI coding agents (Claude Code, Codex, Antigravity, Qwen Code, and custom LLM dev
harnesses) working in this repository must follow the rules, architectural layering
and lifecycle in this document and in
[`.claude/skills/octroi-engineering-standards/SKILL.md`](./.claude/skills/octroi-engineering-standards/SKILL.md).

Human contributors follow the same gates; [`CONTRIBUTING.md`](./CONTRIBUTING.md) is the
short version for people.

Octroi moves real money (USDC on Stellar) on every paid request. Treat every change on
the payment path as security-sensitive.

---

## Core directives

### Directive 1: read-only `main` and worktree isolation

Direct commits or pushes to `main` are forbidden for all AI agents. `main` is the only
long-lived branch.

All feature work, refactoring and bug fixing happens in an isolated Git worktree created
off `origin/main` with `git worktree add`. Never assume a local `main` is current; fetch
first.

### Directive 2: human approval gate (Phase 1, DECIDE)

Agents must not implement non-trivial features, architectural changes, protocol or wire
format changes, or toolchain changes without first writing two Architectural Decision
Records under `docs/adr/`:

1. Technical ADR, `docs/adr/ADR-<YYYY-MM-DD>-<topic>.md`: context, decision,
   architectural impact, trade-offs, and a component or sequence diagram. Start from
   [`docs/adr/TEMPLATE.md`](./docs/adr/TEMPLATE.md).
2. Plain-language companion, `docs/adr/ADR-<YYYY-MM-DD>-<topic>-for-dummies.md`: the
   context, decision and impact for a reader who does not write code. Start from
   [`docs/adr/TEMPLATE-for-dummies.md`](./docs/adr/TEMPLATE-for-dummies.md).

- An agent never approves its own ADR or plan.
- Implementation does not start until a maintainer explicitly approves both documents.
  Silence is not approval. A question about the ADR is not approval.

### Directive 3: red-green bug fixing

For any bug, regression or security defect:

1. Red: write a failing unit or integration test that reproduces the defect. Run it and
   confirm it fails for the reason identified, not for an unrelated one.
2. Green: make the smallest production change that fixes it. Re-run the test and the
   full suite.

The test stays in the codebase as the regression lock.

### Directive 4: no error swallowing, no symptom masking

- No silent `try/catch` blocks or empty catch handlers in TypeScript.
- No ignored `error` values in Go (`_ = f()` or an unchecked return) unless a comment
  says why the error cannot matter.
- No `@ts-ignore`, `@ts-nocheck`, `@ts-expect-error` without a linked issue, or `any`
  casts to get past the typechecker.
- No dummy, empty or fallback values that hide missing data or a broken upstream.
- No commented-out, weakened or deleted assertions or tests.
- No raised timeouts, thresholds or limits to make a gate pass. Fix the cause.

### Directive 5: preflight must pass

Before opening a pull request or calling a task done, run `./scripts/preflight.sh` from
the worktree root. All five gates must pass:

| Gate         | TypeScript                                        | Go (`apps/api-gateway`)            |
| ------------ | ------------------------------------------------- | ---------------------------------- |
| 1. Format    | `pnpm format:check`                               | `gofmt -l .` prints nothing        |
| 2. Lint      | `pnpm lint` (a no-op until issue #38 adds ESLint) | `go vet ./...`                     |
| 3. Typecheck | `pnpm turbo run typecheck`                        | covered by `go vet` and `go build` |
| 4. Tests     | `pnpm test`                                       | `go test ./...` (`-race` in CI)    |
| 5. Build     | `pnpm build`                                      | `go build ./...`                   |

A gate that passes only when run on its own does not count. The full run is the verdict.

---

## Lifecycle (phases 0 to 8)

```
[0 SYNC] --> [1 DECIDE] --> [2 PLAN] --> [3 ISOLATE]
                                              |
[8 DELIVER] <-- [7 DOCUMENT] <-- [6 VERIFY] <-- [5 BUILD]
```

### Phase 0: SYNC

`git fetch --prune origin`. Never rely on a stale local ref.

### Phase 1: DECIDE

For non-trivial work, write both ADRs, present them, and stop until a maintainer
approves. Trivial work (a typo, a copy change, a one-line fix with a regression test)
skips this phase. When unsure, it is not trivial.

### Phase 2: PLAN

`docs/plans/<YYYY-MM-DD>-<feature>-plan.md` from
[`docs/plans/TEMPLATE.md`](./docs/plans/TEMPLATE.md): which packages change, interface
contracts, state changes, and the failing tests to write first.

### Phase 3: ISOLATE

```bash
git fetch origin main
git worktree add .worktrees/<branch-dashed> -b <branch> origin/main
cd .worktrees/<branch-dashed> && pnpm install --frozen-lockfile
```

`.worktrees/` is gitignored.

### Phase 5: BUILD

Test-driven implementation inside the layering rules in the engineering-standards skill.

### Phase 6: VERIFY

Run `./scripts/preflight.sh`. Then run the affected flow by hand (facilitator, gateway,
dashboard or a crawler against the demo middleware) on Stellar testnet, including the
edge cases the ADR named.

### Phase 7: DOCUMENT

Add `docs/release-notes/<YYYY-MM-DD>-<feature>.md` from
[`docs/release-notes/TEMPLATE.md`](./docs/release-notes/TEMPLATE.md), with the
frontmatter and a `scenario-impact` value (`updated`, `needs_automation` or `none`).
CI fails a pull request that changes application code under `apps/` or `packages/`
without one.

### Phase 8: DELIVER

Open the pull request against `main` using
[`.github/pull_request_template.md`](./.github/pull_request_template.md), with
`Closes #<issue>`. The CI `quality` check must be green before review.

---

## Git hooks

Hooks are managed by lefthook (`lefthook.yml`) and installed by `pnpm install`:

- `pre-commit`: Prettier and gofmt on staged files only.
- `commit-msg`: commitlint (Conventional Commits).
- `pre-push`: `./scripts/preflight.sh --fast` (every gate except the build).

Do not bypass them with `--no-verify`. If a pre-existing failure on `main` blocks a push,
report it to the maintainer and fix it in a separate pull request.

---

## Pre-review defect checklist

Check every item before asking for review. The pull request template repeats them.

1. **Boundary validation.** Every external payload (the 402 offer, the `X-PAYMENT`
   header, facilitator `/verify` requests and responses, receipts, gateway request
   bodies) is parsed and validated at the handler and mapped to a type from
   `@octroi/types` or a Go struct. Raw JSON never travels further.
2. **Integer base units.** USDC amounts are integer stroop-scale base units (7
   decimals, `USDC_DECIMALS`): `AtomicUsdc` (a branded `bigint`) in TypeScript, a
   decimal integer string on the wire, `int64` or `*big.Int` in Go. Never `number` or
   `float64`. Format as a USDC decimal only at the display edge.
3. **Exact amount and asset binding.** For the `exact` scheme the authorized amount
   equals the offered price, the asset is the configured USDC SAC, and the recipient is
   the offered `payTo`. Both the facilitator and the middleware check this.
4. **Replay and nonce scope.** Nonces are scoped to the payer (`from`, nonce) and are
   reserved before money moves or a receipt is issued.
5. **Signature verification with pinned keys.** Receipts are verified against the
   facilitator's configured or fetched-and-pinned public key, not only the key embedded
   in the receipt. Request signatures (Web Bot Auth) are verified before any nonce or
   state is recorded.
6. **SSRF on outbound requests.** Any server-side request to a user-supplied URL or
   domain (the gateway probe, discovery fetches) resolves the host and refuses
   loopback, private, link-local and metadata addresses, with timeouts set.
7. **Wiring tests.** Tests cover the real Express or Fastify handlers and Gin routes,
   not only helpers.
8. **Test-first fixes.** Every bug fix was preceded by a failing test that is kept.
9. **Layering.** Imports point downward only; apps never import each other; the Go
   gateway talks to the TypeScript side over HTTP or the shared Postgres schema only.
10. **Preflight.** `./scripts/preflight.sh` passed in full.

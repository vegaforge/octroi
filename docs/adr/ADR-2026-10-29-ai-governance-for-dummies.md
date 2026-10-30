# ADR for Dummies: AI governance, preflight gates and lefthook

- **Status:** Accepted 2026-10-29
- **Date:** 2026-10-29
- **Technical ADR:** [ADR-2026-10-29-ai-governance](./ADR-2026-10-29-ai-governance.md)

## The idea

Octroi handles real payments, and both outside contributors and AI coding assistants
are about to write code for it. This change writes down the rules they must follow and
makes the computer check them, so nobody has to remember to be careful.

## What people see

1. A contributor reads `AGENTS.md` (agents) or `CONTRIBUTING.md` (people) and knows
   the rules before writing code.
2. For anything bigger than a small fix, an AI assistant writes two short decision
   documents first and waits for the maintainer to say yes.
3. When they commit, their files are formatted automatically and the commit message is
   checked.
4. When they push, the tests and checks run on their machine first.
5. When they open a pull request, GitHub runs the same checks plus a full build, and
   shows one green or red result called `quality`.

## Important limitation

The code-style checker (lint) for TypeScript is still a placeholder. It becomes real in
a separate change (issue #38). Until then, the checks catch formatting, type errors,
failing tests and broken builds, but not style problems.

## What changes

- New rule files for AI assistants and a checklist focused on payment safety.
- One command, `./scripts/preflight.sh`, runs every check.
- Git hooks move from Husky to lefthook. Anyone with an older copy of the repo runs one
  command once (`git config --unset core.hooksPath`).
- Pull requests that change the product need a short release note.
- The pull request form has a checklist.

## What does not change

- No product code changes. Publishers, crawlers and the dashboard behave exactly as
  before.
- The commit message format (Conventional Commits) stays the same.
- Only the maintainer merges.

# ADR for Dummies: ESLint with typed typescript-eslint rules

- **Status:** Accepted 2026-10-29
- **Date:** 2026-10-29
- **Technical ADR:** [ADR-2026-10-29-eslint](./ADR-2026-10-29-eslint.md)

## The idea

Octroi has a "lint" step that does nothing today. This change makes it real: a tool
called ESLint reads the TypeScript code and flags patterns that are known to cause
bugs, before anyone runs the code.

## What people see

1. A contributor saves a file with a risky pattern, for example a background task whose
   failure nobody would ever notice.
2. Their editor underlines it, and committing the file reports it.
3. If they push anyway, the checks on their machine and on GitHub fail with the exact
   line and rule.
4. They fix the code and the checks go green.

## Important limitation

A trial run found 52 issues in the current code. Two are real bugs on the payment path
(an error in the publisher's middleware that can go unhandled, and receipts read without
being checked). Most of the rest are tidy-ups. All of them get fixed in the same change,
which makes that change larger than a typical one.

## What changes

- `pnpm lint` checks every TypeScript package and app and fails on any problem.
- The commit hook also lints the files being committed.
- The two real bugs found by the trial run get fixed, each with a test.

## What does not change

- The Go gateway is checked by its own tools, as before.
- Formatting is still Prettier's job.
- Nothing changes for publishers or crawlers, except that the two bugs are gone.

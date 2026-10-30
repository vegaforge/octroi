---
date: 2026-10-29
feature: Octroi wordmark and brand assets, plus docs that match the code after the Stellar migration
scope: docs
issue: 35
scenario-impact: none
---

# Rebrand and migration drift

For anyone visiting the dashboard: the logo in the site header, the dashboard header and
the footer now reads "Octroi". It previously drew the old "CrawlPay" wordmark while
announcing itself to screen readers as "Octroi". The favicon and the standalone brand
SVGs now say "Octroi" in their accessible name and title.

For contributors: the README status note, the gateway run command, the Go requirement
and the x402 compatibility statement now describe the code as it is. CONTRIBUTING no
longer claims ESLint runs on commit and lists the Go gates. The CHANGELOG records the
Soroban signing and settlement work (#1, #2, #3), the Go gateway port (#18) and the
rename (#30) instead of a stale "Pending" entry.

Technical shape: the wordmark is "Octroi" set in Geist SemiBold (weight 600, which
matches the stem width of the old wordmark), outlined to SVG paths at the same scale
and baseline as before. The lockup view box narrows from 280 to 215 units wide so the
shorter word keeps the same right margin. `Logo.tsx` and `public/brand/lockup.svg`
share the same paths.

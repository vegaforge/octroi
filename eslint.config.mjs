// One ESLint config for every TypeScript package and app. Each package runs
// `eslint . --max-warnings 0` from its own directory (so Turbo caches per package), and
// ESLint 9 finds this file by walking up from there. Patterns below are relative to this
// file. Decision record: docs/adr/ADR-2026-10-29-eslint.md.
import path from 'node:path';
import js from '@eslint/js';
import { FlatCompat } from '@eslint/eslintrc';
import { defineConfig, globalIgnores } from 'eslint/config';
import tseslint from 'typescript-eslint';

const dashboardDir = path.join(import.meta.dirname, 'apps/web-dashboard');

// eslint-config-next 15 ships only the legacy eslintrc format, so it goes through
// FlatCompat. baseDirectory is the dashboard so pnpm resolves eslint-config-next from the
// package that depends on it. Next 16 exports flat config natively and replaces this.
const nextCompat = new FlatCompat({ baseDirectory: dashboardDir });

export default defineConfig(
  globalIgnores([
    '**/dist/**',
    '**/.next/**',
    '**/node_modules/**',
    '**/next-env.d.ts',
    '.worktrees/**',
    'apps/api-gateway/**',
  ]),

  {
    files: ['**/*.{ts,tsx,js,mjs,cjs}'],
    extends: [js.configs.recommended, tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Already in the preset. Listed so nobody turns them off quietly: a dropped promise
      // on the payment path is a lost error or an unhandled rejection.
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      // AGENTS.md Directive 4: no `any` and no blanket ts comments.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/ban-ts-comment': [
        'error',
        {
          'ts-expect-error': 'allow-with-description',
          'ts-ignore': true,
          'ts-nocheck': true,
          minimumDescriptionLength: 10,
        },
      ],
      // A leading underscore marks a parameter that an interface requires but this
      // implementation does not use. That is the existing convention in the code.
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' },
      ],
      // Type-only imports are erased at build time; keeping them marked avoids runtime
      // import cycles between packages.
      '@typescript-eslint/consistent-type-imports': 'error',
    },
  },

  {
    files: ['apps/web-dashboard/**/*.{ts,tsx,js,mjs,cjs}'],
    extends: [nextCompat.extends('next/core-web-vitals', 'next/typescript')],
    settings: { next: { rootDir: 'apps/web-dashboard/' } },
  },

  {
    // Test stubs implement async interfaces without awaiting anything.
    files: ['**/__tests__/**/*.ts'],
    rules: { '@typescript-eslint/require-await': 'off' },
  },

  {
    // Plain JS config files, and the vitest configs, which sit outside each package's
    // tsconfig `include` (src/**), so there is no type information for them.
    files: ['**/*.{js,mjs,cjs}', '**/vitest.config.ts'],
    extends: [tseslint.configs.disableTypeChecked],
  },
);

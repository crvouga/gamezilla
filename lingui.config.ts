import { defineConfig } from '@lingui/cli';
import { formatter } from '@lingui/format-po';

/**
 * Root Lingui config: catalog location + extraction scope.
 *
 * Extraction covers whole product trees so a new package with `t` / `<Trans>`
 * cannot ship hashed ids just because this file was not updated.
 *
 * Runtime macro output is JSX-runtime specific. This root config emits the
 * React shape (used by Metro / bun:test until the RN tree is deleted);
 * `lingui.solid.config.ts` layers the Solid shape on top for Vite / Vitest.
 */
export const LINGUI_CATALOG_INCLUDE = [
  '<rootDir>/apps/client/src',
  '<rootDir>/libs',
  '<rootDir>/pkgs',
  '<rootDir>/product/console/src',
] as const;

export const LINGUI_JSX_MACRO_PACKAGES = [
  '@lingui/react/macro',
  '@lingui/solid/macro',
] as const;

export default defineConfig({
  sourceLocale: 'en',
  locales: ['en'],
  compileNamespace: 'ts',
  // Keep file-path origins (useful for translators) but omit line numbers so
  // unrelated refactors don't churn the .po catalog and break the i18n check.
  format: formatter({ origins: true, lineNumbers: false }),
  macro: {
    jsxPackage: [...LINGUI_JSX_MACRO_PACKAGES],
  },
  catalogs: [
    {
      path: '<rootDir>/apps/client/src/i18n/locales/{locale}/messages',
      include: [...LINGUI_CATALOG_INCLUDE],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/tests/**',
        '**/*.test.{ts,tsx}',
      ],
    },
  ],
});

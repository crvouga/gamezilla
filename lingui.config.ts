import { defineConfig } from '@lingui/cli';
import { formatter } from '@lingui/format-po';

import { LINGUI_CATALOG_SOURCES } from './libs/tools/scripts/lingui-scope';

/**
 * Root Lingui config: catalog location + extraction scope.
 *
 * Extraction covers the source trees that use a macro
 * (`libs/tools/scripts/lingui-scope.ts`); each package's `lint` fails if one
 * of its files uses a macro outside them, so a new package with `t` /
 * `<Trans>` cannot ship hashed ids just because the list was not updated.
 *
 * Runtime macro output is JSX-runtime specific. This root config emits the
 * Solid shape; `lingui.solid.config.ts` layers the Solid shape on top for
 * Vite and `bun test` (`@pkgs/bun-test-solid`).
 */
export const LINGUI_CATALOG_INCLUDE = LINGUI_CATALOG_SOURCES.map(
  (dir) => `<rootDir>/${dir}`
);

export const LINGUI_JSX_MACRO_PACKAGES = ['@lingui/solid/macro'] as const;

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
      path: '<rootDir>/libs/client-app/src/i18n/locales/{locale}/messages',
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

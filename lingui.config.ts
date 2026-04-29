import { defineConfig } from '@lingui/conf';

/**
 * Single runtime catalog for the Expo client (includes workspace UI + example libs).
 * Add locales here when supporting new languages.
 */
export default defineConfig({
  sourceLocale: 'en',
  locales: ['en'],
  compileNamespace: 'ts',
  catalogs: [
    {
      path: '<rootDir>/apps/client/src/i18n/locales/{locale}/messages',
      include: [
        '<rootDir>/apps/client/src',
        '<rootDir>/libs/lib/src',
        '<rootDir>/libs/patch-db-example/src',
        '<rootDir>/libs/room-example/src',
      ],
    },
  ],
});

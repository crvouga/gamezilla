// @ts-check
/** @type {import('@lingui/conf').LinguiConfig} */
module.exports = {
  sourceLocale: 'en',
  locales: ['en'],
  compileNamespace: 'ts',
  // Keep file-path origins (useful for translators) but omit line numbers so
  // unrelated refactors don't churn the .po catalog and break `ci:i18n`.
  formatOptions: {
    origins: true,
    lineNumbers: false,
  },
  catalogs: [
    {
      path: '<rootDir>/packages/client/src/i18n/locales/{locale}/messages',
      include: [
        '<rootDir>/packages/client/src',
        '<rootDir>/packages/lib/src',
        '<rootDir>/packages/ui/src',
        '<rootDir>/packages/patch-db-example/src',
        '<rootDir>/packages/room-example/src',
        '<rootDir>/packages/chess/src',
        '<rootDir>/packages/profile/src',
        '<rootDir>/packages/auth/src',
        '<rootDir>/packages/spaces/src',
        '<rootDir>/packages/client-config/src',
      ],
    },
  ],
};

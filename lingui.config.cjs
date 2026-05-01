// @ts-check
/** @type {import('@lingui/conf').LinguiConfig} */
module.exports = {
  sourceLocale: 'en',
  locales: ['en'],
  compileNamespace: 'ts',
  // Keep file-path origins (useful for translators) but omit line numbers so
  // unrelated refactors don't churn the .po catalog and break `i18n:check`.
  formatOptions: {
    origins: true,
    lineNumbers: false,
  },
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
};

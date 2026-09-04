// @ts-check
/** @type {import('@lingui/conf').LinguiConfig} */
module.exports = {
  sourceLocale: 'en',
  locales: ['en'],
  compileNamespace: 'ts',
  // Keep file-path origins (useful for translators) but omit line numbers so
  // unrelated refactors don't churn the .po catalog and break the i18n check.
  formatOptions: {
    origins: true,
    lineNumbers: false,
  },
  catalogs: [
    {
      path: '<rootDir>/apps/client/src/i18n/locales/{locale}/messages',
      // Whole product trees so a new package with `t` / `<Trans>` cannot ship
      // hashed ids just because lingui.config.cjs was not updated.
      include: [
        '<rootDir>/apps/client/src',
        '<rootDir>/libs',
        '<rootDir>/pkgs',
        '<rootDir>/sim/console/src',
      ],
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/tests/**',
        '**/*.test.{ts,tsx}',
      ],
    },
  ],
};

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
      path: '<rootDir>/apps/client/src/i18n/locales/{locale}/messages',
      include: [
        '<rootDir>/apps/client/src',
        '<rootDir>/pkgs/ui/src',
        '<rootDir>/pkgs/chess-board/src',
        '<rootDir>/pkgs/room-widgets/src',
        '<rootDir>/libs/chess/src',
        '<rootDir>/libs/profile/src',
        '<rootDir>/libs/auth/src',
        '<rootDir>/libs/spaces/src',
        '<rootDir>/pkgs/llm/src',
        '<rootDir>/pkgs/tts/src',
        '<rootDir>/libs/client-config/src',
      ],
    },
  ],
};

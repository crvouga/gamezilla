// @ts-check
/** @type {import('@lingui/conf').LinguiConfig} */
module.exports = {
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
};

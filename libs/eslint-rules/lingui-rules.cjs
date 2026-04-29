'use strict';

/**
 * Shared Lingui ESLint rules (flat config).
 * @returns {Record<string, import('eslint').Linter.RuleEntry>}
 */
function linguiRules() {
  return {
    'lingui/no-unlocalized-strings': [
      'warn',
      {
        ignore: ['^[A-Z0-9_-]+$', '^[a-z]+(\\.[a-z0-9-]+)+$'],
        ignoreNames: [
          'testID',
          'nativeID',
          'id',
          'key',
          'role',
          'type',
          'name',
          'src',
          'href',
          'fontFamily',
          'variant',
          'color',
          'icon',
          'displayName',
          'accessibilityRole',
          'aria-level',
          'numberOfLines',
          'ellipsizeMode',
          { regex: { pattern: 'className', flags: 'i' } },
        ],
        ignoreFunctions: [
          'console.*',
          '*.includes',
          '*.startsWith',
          '*.endsWith',
          '*.indexOf',
          '*.match',
          '*.test',
          'require',
          'asLocalized',
          'JSON.stringify',
          'String',
          'i18n.loadAndActivate',
          'i18n._',
        ],
        useTsTypes: false,
        ignoreMethodsOnTypes: ['Map.get', 'Map.has', 'Set.has'],
      },
    ],
    'lingui/t-call-in-function': 'error',
    'lingui/no-trans-inside-trans': 'error',
    'lingui/no-expression-in-message': 'warn',
    'lingui/no-single-tag-to-translate': 'warn',
    'lingui/no-single-variables-to-translate': 'warn',
  };
}

module.exports = { linguiRules };

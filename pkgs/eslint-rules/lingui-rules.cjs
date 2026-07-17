'use strict';

/**
 * Shared Lingui ESLint rules (flat config).
 * @returns {Record<string, import('eslint').Linter.RuleEntry>}
 */
function linguiRules() {
  return {
    'lingui/t-call-in-function': 'error',
    'lingui/no-trans-inside-trans': 'error',
    'lingui/no-expression-in-message': 'error',
    'lingui/no-single-tag-to-translate': 'error',
    'lingui/no-single-variables-to-translate': 'error',
  };
}

module.exports = { linguiRules };

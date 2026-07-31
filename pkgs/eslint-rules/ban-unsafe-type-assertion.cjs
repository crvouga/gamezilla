/**
 * Type-aware ESLint fragments for `@typescript-eslint/no-unsafe-type-assertion`.
 * Merge into your package's existing TypeScript file block so parserOptions stay intact.
 *
 * @param {string} tsconfigRootDir - `__dirname` of the package eslint.config.js
 */
const fs = require('fs');
const path = require('path');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

function findMonorepoRoot(startDir) {
  let dir = path.resolve(startDir);
  for (;;) {
    if (
      fs.existsSync(path.join(dir, 'tsconfig.json')) &&
      fs.existsSync(path.join(dir, 'bun.lock'))
    ) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(
        `ban-unsafe-type-assertion: monorepo root not found from ${startDir}`
      );
    }
    dir = parent;
  }
}

function parserOptions(tsconfigRootDir) {
  return {
    projectService: true,
    tsconfigRootDir: findMonorepoRoot(tsconfigRootDir),
  };
}

function plugins() {
  return {
    '@typescript-eslint': tsPlugin,
  };
}

function rules() {
  return {
    '@typescript-eslint/no-unsafe-type-assertion': 'error',
  };
}

module.exports = { parserOptions, plugins, rules };

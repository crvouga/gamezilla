// @ts-check
import { readFileSync } from 'node:fs';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import solidPlugin from 'eslint-plugin-solid';
import solidTypescript from 'eslint-plugin-solid/configs/typescript';
import tseslint from 'typescript-eslint';

/**
 * ESLint is scoped to Solid code (Biome covers everything else).
 * The scope ratchets outward per port phase via `tools/port/solid-scope.json`.
 */
const scope = /** @type {{ dirs: string[]; files: string[] }} */ (
  JSON.parse(
    readFileSync(
      new URL('./tools/port/solid-scope.json', import.meta.url),
      'utf8'
    )
  )
);

const solidFiles = [
  ...scope.dirs.flatMap((dir) => [`${dir}/**/*.ts`, `${dir}/**/*.tsx`]),
  ...scope.files,
];

/**
 * Rules that only apply to Solid 2.0 or SolidStart server functions.
 * The app is on Solid 1.9 + plain Vite; these would flag valid 1.x code.
 */
const NOT_APPLICABLE_SOLID_RULES = new Set([
  'removed-api',
  'no-single-arg-create-effect',
  'prefer-onSettled-for-side-effects',
  'no-restated-default-options',
  'no-browser-globals-in-server-function',
  'no-invalid-server-capture',
  'require-async-server-function',
  'valid-use-server',
  // Style preferences that fight the design-system `sx` model.
  'prefer-classlist',
  'prefer-structured-class',
]);

/** Every applicable eslint-plugin-solid rule at `error`; the preset leaves several at `warn`. */
const allSolidRulesAsErrors = Object.fromEntries(
  Object.keys(solidPlugin.rules)
    .filter((name) => !NOT_APPLICABLE_SOLID_RULES.has(name))
    .map((name) => [`solid/${name}`, 'error'])
);

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.turbo/**',
      '**/.wrangler/**',
      '**/coverage/**',
    ],
  },
  {
    files: solidFiles,
    extends: [
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      solidTypescript,
      jsxA11y.flatConfigs.strict,
    ],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      ...allSolidRulesAsErrors,
      // Biome owns unused-variable reporting (with its own ignore semantics).
      '@typescript-eslint/no-unused-vars': 'off',
      // Solid components are plain functions returning JSX; `props` access is by design.
      '@typescript-eslint/unbound-method': 'off',
      '@typescript-eslint/restrict-template-expressions': [
        'error',
        { allowNumber: true },
      ],
      // Repo convention is `type` aliases (Biome-era codebase); keep it uniform.
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/no-confusing-void-expression': [
        'error',
        { ignoreArrowShorthand: true },
      ],
      // Build target is es2022; stores (Proxy) are part of the target stack.
      'solid/no-proxy-apis': 'off',
      // A JavaScript switch in a component runs only during setup. Render
      // reactive branches with Solid's <Switch>/<Match> components instead.
      'no-restricted-syntax': [
        'error',
        {
          selector:
            ':matches(FunctionDeclaration[id.name=/^[A-Z]/], VariableDeclarator[id.name=/^[A-Z]/] > ArrowFunctionExpression) SwitchStatement',
          message:
            'Use Solid <Switch>/<Match> for component rendering instead of a JavaScript switch.',
        },
      ],
      // These two rules call `minimatch` v3's default export; the root
      // `overrides` pins minimatch@10 (security), which crashes the linter.
      // Biome's `a11y/noLabelWithoutControl` covers the label case.
      'jsx-a11y/label-has-associated-control': 'off',
      'jsx-a11y/control-has-associated-label': 'off',
    },
  },
  {
    files: scope.dirs.flatMap((dir) => [
      `${dir}/**/*.test.ts`,
      `${dir}/**/*.test.tsx`,
    ]),
    rules: {
      '@typescript-eslint/no-empty-function': 'off',
      '@typescript-eslint/no-floating-promises': 'off',
    },
  }
);

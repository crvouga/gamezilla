/**
 * oxlint lints the Solid scope (Biome covers everything else). The scope
 * ratchets outward per port phase via `libs/tools-harness-ts/port/solid-scope.json`, the
 * single source of truth `lint-package.ts` also reads to pick its targets.
 *
 * Three tiers, as overrides keyed off that file:
 * - `dirs` / `files`: full Solid — typescript-eslint strict + stylistic
 *   (type-aware through oxlint-tsgolint), jsx-a11y strict, every applicable
 *   eslint-plugin-solid rule.
 * - `reactivityDirs`: core Solid reactivity rules only.
 * - `noDestructureDirs`: `solid/no-destructure` only (Accessor-passing ratchet
 *   is a follow-up).
 *
 * The one ESLint rule oxlint cannot express — `no-restricted-syntax` banning a
 * JS `switch` inside a PascalCase component — lives in the Biome Grit plugin
 * `libs/tools-harness-ts/biome-plugins/no-switch-in-component.grit`.
 */
import { defineConfig } from 'oxlint';
import scope from './libs/tools-harness-ts/port/solid-scope.json' with {
  type: 'json',
};

type SolidScope = {
  readonly dirs: readonly string[];
  readonly files: readonly string[];
  readonly reactivityDirs?: readonly string[];
  readonly noDestructureDirs?: readonly string[];
};

const solidScope: SolidScope = scope;

const tsGlobs = (dirs: readonly string[]): string[] =>
  dirs.flatMap((dir) => [`${dir}/**/*.ts`, `${dir}/**/*.tsx`]);

/** typescript-eslint `strictTypeChecked` + `stylisticTypeChecked`, as configured before. */
const TYPESCRIPT_RULES = {
  'typescript/adjacent-overload-signatures': 'error',
  'typescript/array-type': 'error',
  'typescript/await-thenable': 'error',
  'typescript/ban-ts-comment': ['error', { minimumDescriptionLength: 10 }],
  'typescript/ban-tslint-comment': 'error',
  'typescript/class-literal-property-style': 'error',
  'typescript/consistent-generic-constructors': 'error',
  'typescript/consistent-indexed-object-style': 'error',
  'typescript/consistent-type-assertions': 'error',
  // Repo convention is `type` aliases (Biome-era codebase); keep it uniform.
  'typescript/consistent-type-definitions': ['error', 'type'],
  'typescript/dot-notation': 'error',
  'typescript/no-array-delete': 'error',
  'typescript/no-base-to-string': 'error',
  'typescript/no-confusing-non-null-assertion': 'error',
  'typescript/no-confusing-void-expression': [
    'error',
    { ignoreArrowShorthand: true },
  ],
  'typescript/no-deprecated': 'error',
  'typescript/no-duplicate-enum-values': 'error',
  'typescript/no-duplicate-type-constituents': 'error',
  'typescript/no-dynamic-delete': 'error',
  'typescript/no-empty-object-type': 'error',
  'typescript/no-explicit-any': 'error',
  'typescript/no-extra-non-null-assertion': 'error',
  'typescript/no-extraneous-class': 'error',
  'typescript/no-floating-promises': 'error',
  'typescript/no-for-in-array': 'error',
  'typescript/no-implied-eval': 'error',
  'typescript/no-inferrable-types': 'error',
  'typescript/no-invalid-void-type': 'error',
  'typescript/no-meaningless-void-operator': 'error',
  'typescript/no-misused-new': 'error',
  'typescript/no-misused-promises': 'error',
  'typescript/no-misused-spread': 'error',
  'typescript/no-mixed-enums': 'error',
  'typescript/no-namespace': 'error',
  'typescript/no-non-null-asserted-nullish-coalescing': 'error',
  'typescript/no-non-null-asserted-optional-chain': 'error',
  'typescript/no-non-null-assertion': 'error',
  'typescript/no-redundant-type-constituents': 'error',
  'typescript/no-require-imports': 'error',
  'typescript/no-this-alias': 'error',
  'typescript/no-unnecessary-boolean-literal-compare': 'error',
  'typescript/no-unnecessary-condition': 'error',
  'typescript/no-unnecessary-template-expression': 'error',
  'typescript/no-unnecessary-type-arguments': 'error',
  'typescript/no-unnecessary-type-assertion': 'error',
  'typescript/no-unnecessary-type-constraint': 'error',
  'typescript/no-unnecessary-type-conversion': 'error',
  'typescript/no-unnecessary-type-parameters': 'error',
  'typescript/no-unsafe-argument': 'error',
  'typescript/no-unsafe-assignment': 'error',
  'typescript/no-unsafe-call': 'error',
  'typescript/no-unsafe-declaration-merging': 'error',
  'typescript/no-unsafe-enum-comparison': 'error',
  'typescript/no-unsafe-function-type': 'error',
  'typescript/no-unsafe-member-access': 'error',
  'typescript/no-unsafe-return': 'error',
  'typescript/no-unsafe-unary-minus': 'error',
  'typescript/no-useless-default-assignment': 'error',
  'typescript/no-wrapper-object-types': 'error',
  'typescript/non-nullable-type-assertion-style': 'error',
  'typescript/only-throw-error': 'error',
  'typescript/prefer-as-const': 'error',
  'typescript/prefer-find': 'error',
  'typescript/prefer-for-of': 'error',
  'typescript/prefer-function-type': 'error',
  'typescript/prefer-includes': 'error',
  'typescript/prefer-literal-enum-member': 'error',
  'typescript/prefer-namespace-keyword': 'error',
  'typescript/prefer-nullish-coalescing': 'error',
  'typescript/prefer-optional-chain': 'error',
  'typescript/prefer-promise-reject-errors': 'error',
  'typescript/prefer-reduce-type-parameter': 'error',
  'typescript/prefer-regexp-exec': 'error',
  'typescript/prefer-return-this-type': 'error',
  'typescript/prefer-string-starts-ends-with': 'error',
  'typescript/related-getter-setter-pairs': 'error',
  'typescript/require-await': 'error',
  'typescript/restrict-plus-operands': [
    'error',
    {
      allowAny: false,
      allowBoolean: false,
      allowNullish: false,
      allowNumberAndString: false,
      allowRegExp: false,
    },
  ],
  'typescript/restrict-template-expressions': ['error', { allowNumber: true }],
  'typescript/return-await': ['error', 'error-handling-correctness-only'],
  'typescript/triple-slash-reference': 'error',
  'typescript/unified-signatures': 'error',
  'typescript/use-unknown-in-catch-callback-variable': 'error',
  // typescript-eslint's extension rules; oxlint's core versions are TS-aware.
  'eslint/no-array-constructor': 'error',
  'eslint/no-empty-function': 'error',
  'eslint/no-unused-expressions': 'error',
  'eslint/no-useless-constructor': 'error',
  // Core rules typescript-eslint's `eslint-recommended` turns on.
  'eslint/no-var': 'error',
  'eslint/prefer-const': 'error',
  'eslint/prefer-rest-params': 'error',
  'eslint/prefer-spread': 'error',
} as const;

/** eslint-plugin-jsx-a11y `strict`, plus the rules the ESLint run could not load. */
const JSX_A11Y_RULES = {
  'jsx-a11y/alt-text': 'error',
  'jsx-a11y/anchor-has-content': 'error',
  'jsx-a11y/anchor-is-valid': 'error',
  'jsx-a11y/aria-activedescendant-has-tabindex': 'error',
  'jsx-a11y/aria-props': 'error',
  'jsx-a11y/aria-proptypes': 'error',
  'jsx-a11y/aria-role': 'error',
  'jsx-a11y/aria-unsupported-elements': 'error',
  'jsx-a11y/autocomplete-valid': 'error',
  'jsx-a11y/click-events-have-key-events': 'error',
  'jsx-a11y/heading-has-content': 'error',
  'jsx-a11y/html-has-lang': 'error',
  'jsx-a11y/iframe-has-title': 'error',
  'jsx-a11y/img-redundant-alt': 'error',
  'jsx-a11y/interactive-supports-focus': [
    'error',
    {
      tabbable: [
        'button',
        'checkbox',
        'link',
        'progressbar',
        'searchbox',
        'slider',
        'spinbutton',
        'switch',
        'textbox',
      ],
    },
  ],
  'jsx-a11y/label-has-associated-control': 'error',
  'jsx-a11y/media-has-caption': 'error',
  'jsx-a11y/mouse-events-have-key-events': 'error',
  'jsx-a11y/no-access-key': 'error',
  'jsx-a11y/no-autofocus': 'error',
  'jsx-a11y/no-distracting-elements': 'error',
  'jsx-a11y/no-interactive-element-to-noninteractive-role': 'error',
  'jsx-a11y/no-noninteractive-element-interactions': [
    'error',
    {
      body: ['onError', 'onLoad'],
      iframe: ['onError', 'onLoad'],
      img: ['onError', 'onLoad'],
    },
  ],
  'jsx-a11y/no-noninteractive-element-to-interactive-role': 'error',
  'jsx-a11y/no-noninteractive-tabindex': 'error',
  'jsx-a11y/no-redundant-roles': 'error',
  'jsx-a11y/no-static-element-interactions': 'error',
  'jsx-a11y/role-has-required-aria-props': 'error',
  'jsx-a11y/role-supports-aria-props': 'error',
  'jsx-a11y/scope': 'error',
  'jsx-a11y/tabindex-no-positive': 'error',
  // oxlint-only correctness rules with no eslint-plugin-jsx-a11y `strict` twin.
  'jsx-a11y/lang': 'error',
  'jsx-a11y/no-aria-hidden-on-focusable': 'error',
  // Off: the design system builds custom ARIA widgets (combobox, listbox,
  // radio chips, live status regions) on purpose; the native tags cannot be
  // styled or composed the same way.
  'jsx-a11y/prefer-tag-over-role': 'off',
} as const;

/** Core reactivity rules for product libs (no a11y / type-checked blast). */
const SOLID_REACTIVITY_RULES = {
  'solid/reactivity': 'error',
  'solid/no-destructure': 'error',
  'solid/components-return-once': 'error',
  'solid/no-react-deps': 'error',
  'solid/no-module-scope-reactive-primitive': 'error',
} as const;

/**
 * Every applicable eslint-plugin-solid rule. Left out on purpose: the Solid
 * 2.0 / SolidStart server-function rules (the app is Solid 1.9 + plain Vite;
 * they flag valid 1.x code), `prefer-classlist` / `prefer-structured-class`
 * (style preferences that fight the design-system class model) and
 * `no-proxy-apis` (build target is es2022; stores are Proxies by design).
 */
const SOLID_RULES = {
  ...SOLID_REACTIVITY_RULES,
  'solid/event-handlers': 'error',
  'solid/imports': 'error',
  'solid/jsx-no-duplicate-props': 'error',
  'solid/jsx-no-script-url': 'error',
  'solid/jsx-no-undef': ['error', { typescriptEnabled: true }],
  'solid/jsx-uses-vars': 'error',
  'solid/no-accessor-as-prop': 'error',
  'solid/no-array-handlers': 'error',
  'solid/no-innerhtml': 'error',
  'solid/no-react-specific-props': 'error',
  'solid/no-unknown-namespaces': 'error',
  'solid/prefer-for': 'error',
  'solid/prefer-show': 'error',
  'solid/self-closing-comp': 'error',
  'solid/style-prop': 'error',
} as const;

export default defineConfig({
  // Nothing runs outside the overrides below: the scope file is the scope.
  plugins: [],
  jsPlugins: ['@shadcn/lint'],
  settings: {
    shadcn: {
      componentImports: ['^@pkgs/ui$'],
      note: 'Use the Tailwind theme in pkgs/tailwind-shared-ts/src/tailwind.css and the components exported by @pkgs/ui.',
    },
  },
  rules: {
    'shadcn/no-arbitrary-values': 'error',
    'shadcn/no-raw-colors': 'error',
    'shadcn/no-unknown-classes': 'error',
  },
  categories: {
    correctness: 'off',
  },
  options: {
    typeAware: true,
    denyWarnings: true,
    // Suppressions say `oxlint-disable`, and a stale one fails the lint.
    respectEslintDisableDirectives: false,
    reportUnusedDisableDirectives: 'error',
  },
  ignorePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/.turbo/**',
    '**/.wrangler/**',
    '**/coverage/**',
  ],
  overrides: [
    {
      files: tsGlobs(solidScope.noDestructureDirs ?? []),
      jsPlugins: ['eslint-plugin-solid'],
      rules: { 'solid/no-destructure': 'error' },
    },
    {
      files: tsGlobs(solidScope.reactivityDirs ?? []),
      jsPlugins: ['eslint-plugin-solid'],
      rules: SOLID_REACTIVITY_RULES,
    },
    {
      files: [...tsGlobs(solidScope.dirs), ...solidScope.files],
      plugins: ['typescript', 'jsx-a11y'],
      jsPlugins: ['eslint-plugin-solid'],
      rules: { ...TYPESCRIPT_RULES, ...JSX_A11Y_RULES, ...SOLID_RULES },
    },
    {
      files: solidScope.dirs.flatMap((dir) => [
        `${dir}/**/*.test.ts`,
        `${dir}/**/*.test.tsx`,
      ]),
      rules: {
        'eslint/no-empty-function': 'off',
        'typescript/no-floating-promises': 'off',
      },
    },
    {
      // Provider logos must retain their official brand colors rather than
      // adapting to the product theme.
      files: ['pkgs/ui-root-client-ts/src/brand-logos/index.tsx'],
      rules: { 'shadcn/no-raw-colors': 'off' },
    },
  ],
});

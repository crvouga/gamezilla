const { createSharedBlocks } = require('../eslint-rules/base-config.cjs');
const a11y = require('../eslint-rules/a11y-restrictions.cjs');

// `@gamezilla/matchmaking` documents three explicit subpaths
// (`.`, `./storage`, `./wire`). The package.json `exports` map and
// the root tsconfig path aliases enforce that at the resolver layer;
// this rule enforces it at the source-author layer. Wildcard re-exports
// silently grow the public surface — a future `export *` from a new
// barrel would bypass the curated subpath maps without warning. Ban
// `export *` outright in this package; explicit named re-exports keep
// the contract auditable.
const forbidExportStar = {
  selector: 'ExportAllDeclaration',
  message:
    'Wildcard re-exports (`export * from ...`) are forbidden in @gamezilla/matchmaking: they bypass the curated public surface (the three subpaths in package.json `exports`). Use explicit `export { ... }` instead.',
};

module.exports = [
  ...createSharedBlocks(__dirname),
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...a11y.restrictedSyntax(),
        forbidExportStar,
      ],
    },
  },
];

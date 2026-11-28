import { expect, test } from 'bun:test';
import {
  privatePackageImports,
  type WorkspaceExports,
} from './private-package-imports';

const dir = 'libs/consumer-client-ts';
const workspace = new Map<string, WorkspaceExports>([
  [
    '@pkgs/conditional-shared-ts',
    { exports: { types: './types.d.ts', default: './runtime.js' } },
  ],
  ['@pkgs/array-shared-ts', { exports: ['./src/index.ts', './index.js'] }],
  [
    '@pkgs/widget-client-ts',
    {
      exports: {
        './widget': './src/widget.ts',
        './fixtures/*': './fixtures/*.ts',
        './fixtures/private': null,
        './fixtures/internal/*': null,
      },
    },
  ],
]);
const legacy = 'tests/old.ts -> pkgs/widget-client-ts/private/helper';
const apply = (path: string, text: string, entries: readonly string[] = []) =>
  privatePackageImports({
    dir,
    files: [{ path, text }],
    workspace,
    legacy: entries,
  });
const access = 'import "../../../pkgs/widget-client-ts/private/helper"';

test('only the exact outstanding fixture access may cross into another package', () => {
  expect(apply('tests/old.ts', access, [legacy])).toEqual([]);
  expect(apply('scripts/new.ts', access)).toHaveLength(1);
  expect(
    apply('src/new.ts', access, [legacy.replace('tests/old', 'src/new')])
  ).toHaveLength(2);
  expect(apply('tests/old.ts', '', [legacy])).toEqual([
    `remove stale legacy private import: ${legacy}`,
  ]);
  expect(apply('src/new.ts', 'import "./sub/../local"')).toEqual([]);
  expect(
    apply(
      'scripts/new.ts',
      'import "../node_modules/@pkgs/widget-client-ts/private/helper"'
    )
  ).toHaveLength(1);
  expect(
    apply(
      'scripts/new.ts',
      String.raw`require("\x2e\x2e/../../pkgs/widget-client-ts/private/helper")`
    )
  ).toHaveLength(1);
});

test('named workspace paths use declared exports and cannot traverse out of them', () => {
  for (const name of ['widget', 'fixtures/shared/nested'])
    expect(
      apply('scripts/test.ts', `export * from "@pkgs/widget-client-ts/${name}"`)
    ).toEqual([]);
  for (const name of [
    'src/widget',
    'private',
    'fixtures/private',
    'fixtures/internal/nested',
    'fixtures/../../outside',
  ])
    expect(
      apply('scripts/test.ts', `require("@pkgs/widget-client-ts/${name}")`)
    ).toHaveLength(1);
});

test('root conditional and array exports admit the package only', () => {
  for (const pkg of ['conditional', 'array']) {
    expect(apply('src/x.ts', `import "@pkgs/${pkg}-shared-ts"`)).toEqual([]);
    expect(
      apply('src/x.ts', `import "@pkgs/${pkg}-shared-ts/index"`)
    ).toHaveLength(1);
  }
});

test('deployment reaches the worker operation through its package export', () => {
  // regression: deploy-scripts-bypass-infra-package
  const check = (text: string) =>
    privatePackageImports({
      dir: 'apps/auth-relay-ts',
      files: [{ path: 'scripts/deploy.ts', text }],
      workspace: new Map([
        [
          '@libs/infra-server-ts',
          { exports: { './worker-deploy': './scripts/worker-deploy.ts' } },
        ],
      ]),
      legacy: [],
    });
  expect(
    check(
      "import { deployAuthRelayWorker } from '../../../libs/infra-server-ts/scripts/worker-deploy';"
    )
  ).toHaveLength(1);
  expect(
    check(
      "import { deployAuthRelayWorker } from '@libs/infra-server-ts/worker-deploy';"
    )
  ).toEqual([]);
});

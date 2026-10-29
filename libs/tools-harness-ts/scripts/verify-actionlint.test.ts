import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';

const WORKFLOWS = [
  'deploy.yml',
  'health.yml',
  'verify-nightly.yml',
  'verify-pr.yml',
];
const SOURCE = readFileSync(
  join(import.meta.dir, 'verify-actionlint.ts'),
  'utf8'
);

function executable(path: string, body: string): void {
  writeFileSync(path, `#!/bin/sh\n${body}\n`);
  chmodSync(path, 0o755);
}

function prepare(root: string, concurrency = ''): void {
  for (const directory of [
    'libs/tools-harness-ts/scripts',
    '.github/workflows',
    'bin',
    'pinned',
  ])
    mkdirSync(join(root, directory), { recursive: true });
  writeFileSync(
    join(root, 'libs/tools-harness-ts/scripts/verify-actionlint.ts'),
    SOURCE
  );
  writeFileSync(join(root, '.github/actionlint.yaml'), '{}\n');
  for (const file of WORKFLOWS)
    writeFileSync(
      join(root, '.github/workflows', file),
      `${concurrency}jobs:\n  deploy:\n    steps: &deployment\n      - run: echo checked\n  production:\n    steps: *deployment\n`
    );
  executable(
    join(root, 'bin/actionlint'),
    'echo "shadow actionlint 1.7.7 rejects YAML aliases" >&2\nexit 73'
  );
  executable(
    join(root, 'pinned/actionlint'),
    'printf "%s\\n" "$@" > "$ACTIONLINT_TEST_ARGS"'
  );
  executable(
    join(root, 'bin/mise'),
    `case "$1" in
  which)
    case "$ACTIONLINT_TEST_RESOLVE" in
      failure) echo "pinned tool unavailable" >&2; exit 19 ;;
      relative) echo actionlint ;;
      *) printf '%s\\n' "$ACTIONLINT_TEST_PINNED" ;;
    esac ;;
  exec)
    shift
    if [ "$1" = -- ]; then shift; fi
    exec "$@" ;;
  *) exit 81 ;;
esac`
  );
}

function runCase(resolve: 'pinned' | 'failure' | 'relative', concurrency = '') {
  const root = mkdtempSync(join(tmpdir(), 'actionlint-pinned-'));
  try {
    prepare(root, concurrency);
    const recorded = join(root, 'args.txt');
    const result = spawnSync(
      process.execPath,
      ['libs/tools-harness-ts/scripts/verify-actionlint.ts'],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${join(root, 'bin')}${delimiter}${process.env['PATH'] ?? ''}`,
          ACTIONLINT_TEST_PINNED: join(root, 'pinned/actionlint'),
          ACTIONLINT_TEST_ARGS: recorded,
          ACTIONLINT_TEST_RESOLVE: resolve,
        },
      }
    );
    return {
      code: result.status,
      stderr: result.stderr,
      args: existsSync(recorded)
        ? readFileSync(recorded, 'utf8').trim().split('\n')
        : [],
    };
  } finally {
    removeTree(root, { whenLocked: 'leave' });
  }
}

// regression: actionlint-path-shadows-pinned-tool
test('the workflow gate uses the selected executable despite an older actionlint on PATH', () => {
  const result = runCase('pinned');
  expect(result.code, result.stderr).toBe(0);
  expect(result.args.slice(0, 3)).toEqual([
    '-color',
    '-config-file',
    '.github/actionlint.yaml',
  ]);
  expect(result.args.slice(-WORKFLOWS.length).sort()).toEqual(
    WORKFLOWS.map((file) => `.github/workflows/${file}`).sort()
  );
});

test('an unavailable selected tool fails instead of using the PATH executable', () => {
  const result = runCase('failure');
  expect(result.code).toBe(19);
  expect(result.args).toEqual([]);
});

test('a relative tool selection cannot fall back to PATH', () => {
  const result = runCase('relative');
  expect(result.code).toBe(1);
  expect(result.args).toEqual([]);
});

test('valid queued releases pass through the pinned tool', () => {
  const result = runCase(
    'pinned',
    'concurrency:\n  group: release\n  queue: max\n  cancel-in-progress: false\n'
  );
  expect(result.code, result.stderr).toBe(0);
  expect(result.args).toContain('-ignore');
});

test('unsupported queues and cancellation of queued releases fail before lint', () => {
  for (const concurrency of [
    'concurrency:\n  group: release\n  queue: invalid\n',
    'concurrency:\n  group: release\n  queue: max\n  cancel-in-progress: true\n',
  ]) {
    const result = runCase('pinned', concurrency);
    expect(result.code).not.toBe(0);
    expect(result.args).toEqual([]);
  }
});

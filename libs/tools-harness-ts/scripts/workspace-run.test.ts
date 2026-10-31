import { afterEach, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { renameReplacing } from '@pkgs/fs-server-ts/rename-replacing';

const hooks = join(import.meta.dirname, '../workspace');
const DEV = 'bun run --silent dev -- --web-port 5800 --keep-data';
const INSTALL = 'bun install --frozen-lockfile';

const checkouts: string[] = [];
afterEach(() => {
  for (const dir of checkouts.splice(0))
    removeTree(dir, { whenLocked: 'leave' });
});

function writeExecutable(path: string, body: string): void {
  writeFileSync(path, body, { mode: 0o755 });
}

/** Recorders stand in for bun, git, mise and infisical. A successful install
 * brings turbo with it, the way a real install does. */
function writeFakeTools(dir: string): void {
  mkdirSync(join(dir, '.bin'));
  writeExecutable(
    join(dir, '.bin/bun'),
    '#!/usr/bin/env bash\n' +
      'if [ -n "${WORKSPACE_RUN_TEST_RECORD_UI:-}" ]; then\n' +
      '  printf "bun %s TURBO_UI=%s\\n" "$*" "${TURBO_UI-}" >> "$WORKSPACE_RUN_TEST_CALLS"\n' +
      'else\n' +
      '  printf "bun %s\\n" "$*" >> "$WORKSPACE_RUN_TEST_CALLS"\n' +
      'fi\n' +
      'if [ "$1" = "run" ] && [ "$2" = "secrets:pull" ]; then exit 1; fi\n' +
      'if [ "$1" = "install" ]; then\n' +
      '  [ "${WORKSPACE_RUN_TEST_INSTALL:-ok}" = "ok" ] || exit 1\n' +
      '  mkdir -p node_modules/.bin\n' +
      '  printf "#!/usr/bin/env bash\\nprintf \\"turbo %%s\\\\n\\" \\"\\$*\\" >> \\"\\$WORKSPACE_RUN_TEST_CALLS\\"\\n" > node_modules/.bin/turbo\n' +
      '  chmod +x node_modules/.bin/turbo\n' +
      'fi\n'
  );
  writeExecutable(
    join(dir, '.bin/git'),
    '#!/usr/bin/env bash\n' +
      'case "$*" in\n' +
      '  "diff --name-only --diff-filter=U -z")\n' +
      '    printf "%s" "${WORKSPACE_RUN_TEST_UNMERGED:-}" | tr "\\n" "\\0" ;;\n' +
      '  *"rev-parse --path-format=absolute --git-common-dir"*)\n' +
      '    if [ -n "${WORKSPACE_RUN_TEST_ROOT:-}" ]; then\n' +
      '      printf "%s\\n" "$WORKSPACE_RUN_TEST_ROOT/.git"\n' +
      '    fi ;;\n' +
      'esac\n'
  );
  writeExecutable(
    join(dir, '.bin/mise'),
    '#!/usr/bin/env bash\n' +
      'if [ -n "${WORKSPACE_RUN_TEST_RECORD_SYSTEM:-}" ]; then\n' +
      '  printf "mise %s\\n" "$*" >> "$WORKSPACE_RUN_TEST_CALLS"\n' +
      'fi\n' +
      'if [ "$1" = "env" ]; then printf \'export PATH="%s:$PATH"\\n\' "$PWD/.tools"; fi\n' +
      'if [ "$1" = "install" ] && [ "${WORKSPACE_RUN_TEST_SYSTEM:-ok}" != "ok" ]; then exit 1; fi\n' +
      '[ "$1" = "install" ] && echo "mise: installing every tool"\n' +
      'exit 0\n'
  );
  writeExecutable(join(dir, '.bin/infisical'), '#!/usr/bin/env bash\nexit 0\n');
}

/**
 * A throwaway checkout holding the real hooks, with the tools above replaced
 * so a hook can be observed without installing or booting.
 */
function checkout() {
  const dir = mkdtempSync(join(tmpdir(), 'workspace-run-'));
  checkouts.push(dir);
  const calls = join(dir, '.calls');
  cpSync(hooks, join(dir, 'libs/tools-harness-ts/workspace'), {
    recursive: true,
  });
  writeFakeTools(dir);
  mkdirSync(join(dir, 'apps/product-ts'), { recursive: true });
  writeFileSync(join(dir, 'bun.lock'), '{}\n');
  writeFileSync(join(dir, 'mise.toml'), '[tools]\nbun = "1.4.3"\n');
  writeFileSync(join(dir, 'package.json'), '{"name":"root"}\n');
  writeFileSync(join(dir, 'apps/product-ts/package.json'), '{"name":"app"}\n');
  const script = (name: string, args: readonly string[] = []) => {
    return (env: Record<string, string> = {}) => {
      rmSync(calls, { force: true });
      const result = spawnSync(
        'bash',
        [join(dir, 'libs/tools-harness-ts/workspace', name), ...args],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            HOME: join(dir, 'home'),
            ...env,
            PATH: `${join(dir, '.bin')}:/usr/bin:/bin`,
            VITE_PORT: '5800',
            WORKSPACE_RUN_TEST_CALLS: calls,
          },
        }
      );
      const recorded = existsSync(calls) ? readFileSync(calls, 'utf8') : '';
      return {
        ...result,
        calls: recorded.split('\n').filter((line) => line.length > 0),
      };
    };
  };
  return {
    dir,
    run: script('run.sh'),
    setup: script('setup.sh'),
    teardown: script('teardown.sh'),
    check: script('check.sh'),
    port: script('port.sh'),
    step: (name: string) => script('step.sh', [name]),
  };
}

// regression: workspace-setup-failure-stamp
test('failed setup is not accepted as a prepared checkout and can be retried', () => {
  const { dir, setup, run } = checkout();
  expect(setup({ WORKSPACE_RUN_TEST_INSTALL: 'fail' }).status).not.toBe(0);
  expect(
    existsSync(join(dir, 'node_modules/.workspace-install-fingerprint'))
  ).toBe(false);
  expect(run().status).not.toBe(0);
  expect(setup().status).toBe(0);
  expect(run().calls).toEqual([DEV]);
});

// regression: workspace-cold-secrets-pull
// regression: workspace-setup-credential-copy
test('setup leaves credentials in other checkouts and preserves local files', () => {
  const { dir, setup } = checkout();
  const root = join(dir, 'main-checkout');
  mkdirSync(join(root, '.git'), { recursive: true });
  mkdirSync(join(root, '.cache/secrets'), { recursive: true });
  writeFileSync(join(root, '.cache/secrets/prd.json'), 'private');
  writeFileSync(join(dir, 'apps/product-ts/.env.local'), 'local');
  expect(setup({ WORKSPACE_RUN_TEST_ROOT: root }).status).toBe(0);
  expect(existsSync(join(dir, '.cache/secrets'))).toBe(false);
  expect(readFileSync(join(dir, 'apps/product-ts/.env.local'), 'utf8')).toBe(
    'local'
  );
});

// regression: workspace-run-preflight-dependency-failure
// regression: workspace-run-turbo-ui-stream
test('run respects the caller UI and never installs or starts before setup', () => {
  const { setup, run } = checkout();
  expect(run().status).not.toBe(0);
  setup();
  const result = run({ TURBO_UI: 'stream', WORKSPACE_RUN_TEST_RECORD_UI: '1' });
  expect(result.status).toBe(0);
  expect(result.calls).toEqual([`${DEV} TURBO_UI=stream`]);
});

// regression: workspace-run-stale-install
test('setup is repeatable and restores missing or changed dependencies', () => {
  const { dir, setup, run } = checkout();
  expect(setup().calls).toEqual([INSTALL]);
  expect(setup().calls).toEqual([]);
  writeFileSync(
    join(dir, 'apps/product-ts/package.json'),
    '{"name":"changed"}'
  );
  expect(run().status).not.toBe(0);
  expect(setup().calls).toEqual([INSTALL]);
  removeTree(join(dir, 'node_modules'), { whenLocked: 'leave' });
  expect(setup().calls).toEqual([INSTALL]);
});

// regression: workspace-run-missing-system-tools
test('setup activates pinned tools and does not install dependencies if tools fail', () => {
  const { dir, setup } = checkout();
  mkdirSync(join(dir, '.tools'));
  renameReplacing(join(dir, '.bin/bun'), join(dir, '.tools/bun'));
  expect(setup({ WORKSPACE_RUN_TEST_SYSTEM: 'fail' }).status).not.toBe(0);
  const result = setup({ WORKSPACE_RUN_TEST_RECORD_SYSTEM: '1' });
  expect(result.status).toBe(0);
  expect(result.calls).toEqual([
    'mise trust --quiet mise.toml',
    'mise install --yes',
    'mise env --shell bash',
    INSTALL,
  ]);
});

// regression: workspace-teardown-foreign-listener
test('teardown delegates to checkout ownership without probing or killing by port', () => {
  const { dir, setup, teardown } = checkout();
  setup();
  writeExecutable(join(dir, '.bin/lsof'), '#!/usr/bin/env bash\nexit 99\n');
  const result = teardown();
  expect(result.status).toBe(0);
  expect(result.calls).toEqual(['bun run kill']);
  expect(teardown().calls).toEqual(['bun run kill']);
});

test('the merge task names an unfinished merge', () => {
  const { step } = checkout();
  const result = step('merge')({
    WORKSPACE_RUN_TEST_UNMERGED: 'conflicted.ts\n',
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('merge in progress: 1 unmerged path(s)');
});

// regression: workspace-storybook-port-collision
test('two explicitly selected workspace blocks give Storybook distinct ports', () => {
  const { dir } = checkout();
  const selected = (port: string) =>
    spawnSync(
      'bash',
      [
        '-c',
        'set -e; . "$1"; printf "%s" "$STORYBOOK_PORT"',
        'ports',
        join(dir, 'libs/tools-harness-ts/workspace/port.sh'),
      ],
      { encoding: 'utf8', env: { ...process.env, VITE_PORT: port } }
    );
  expect(selected('5800').stdout).toBe('5802');
  expect(selected('5804').stdout).toBe('5806');
  expect(selected('invalid').status).not.toBe(0);
});

// regression: workspace-bootstrapped-mise-path
test('run and checks find mise bootstrapped by setup without a parent PATH change', () => {
  const { dir, setup, run, check } = checkout();
  mkdirSync(join(dir, 'home/.local/bin'), { recursive: true });
  mkdirSync(join(dir, '.tools'));
  renameReplacing(join(dir, '.bin/mise'), join(dir, 'home/.local/bin/mise'));
  renameReplacing(join(dir, '.bin/bun'), join(dir, '.tools/bun'));
  expect(setup().status).toBe(0);
  expect(run().calls).toEqual([DEV]);
  expect(check().calls).toEqual(['bun verify']);
});

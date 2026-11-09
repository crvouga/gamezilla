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
const STOP = 'bun libs/tools-harness-ts/scripts/kill-dev-stack.ts';

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
      '  [ "${WORKSPACE_RUN_TEST_INSTALL:-ok}" != "fail" ] || exit 1\n' +
      '  mkdir -p node_modules/.bin\n' +
      '  printf "#!/usr/bin/env bash\\nprintf \\"turbo %%s\\\\n\\" \\"\\$*\\" >> \\"\\$WORKSPACE_RUN_TEST_CALLS\\"\\n" > node_modules/.bin/turbo\n' +
      '  chmod +x node_modules/.bin/turbo\n' +
      '  [ "${WORKSPACE_RUN_TEST_INSTALL:-ok}" != "partial" ] || exit 1\n' +
      'fi\n'
  );
  writeExecutable(
    join(dir, '.bin/git'),
    '#!/usr/bin/env bash\n' +
      'case "$*" in\n' +
      '  "config --get core.hooksPath")\n' +
      '    [ "${WORKSPACE_RUN_TEST_HOOKS:-}" = "present" ] && exit 0\n' +
      '    exit 1 ;;\n' +
      '  "rev-parse --git-path hooks")\n' +
      '    printf "%s\\n" "$PWD/.git/hooks" ;;\n' +
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
    prepare: script('prepare.sh'),
    teardown: script('teardown.sh'),
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
  expect(run({ WORKSPACE_RUN_TEST_INSTALL: 'fail' }).status).not.toBe(0);
  const prepared = setup();
  expect(prepared.status, `${prepared.stdout}\n${prepared.stderr}`).toBe(0);
  expect(run().calls).toEqual([STOP, DEV]);
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
// regression: workspace-run-auto-setup
test('run prepares a cold checkout and preserves the caller UI on warm launches', () => {
  const { run } = checkout();
  const cold = run();
  expect(cold.status).toBe(0);
  expect(cold.calls).toEqual([INSTALL, STOP, DEV]);
  const result = run({ TURBO_UI: 'stream', WORKSPACE_RUN_TEST_RECORD_UI: '1' });
  expect(result.status).toBe(0);
  expect(result.calls).toEqual([
    `${STOP} TURBO_UI=stream`,
    `${DEV} TURBO_UI=stream`,
  ]);
});

// regression: workspace-run-reuse-silent
test('every Start stack replaces this checkout’s stack before choosing ports', () => {
  const { run } = checkout();
  run();
  for (let attempt = 0; attempt < 3; attempt++) {
    const result = run();
    expect(result.status).toBe(0);
    expect(result.calls).toEqual([STOP, DEV]);
  }
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
  expect(run().calls).toEqual([INSTALL, STOP, DEV]);
  expect(setup().calls).toEqual([]);
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
test('run finds mise bootstrapped by setup without a parent PATH change', () => {
  const { dir, setup, run } = checkout();
  mkdirSync(join(dir, 'home/.local/bin'), { recursive: true });
  mkdirSync(join(dir, '.tools'));
  renameReplacing(join(dir, '.bin/mise'), join(dir, 'home/.local/bin/mise'));
  renameReplacing(join(dir, '.bin/bun'), join(dir, '.tools/bun'));
  expect(setup().status).toBe(0);
  expect(run().calls).toEqual([STOP, DEV]);
});

// regression: separated-setup-release-policy
test('a failed tool refresh tells the team and leaves a prepared environment openable', () => {
  const { setup, run } = checkout();
  expect(setup().status).toBe(0);
  const failed = setup({ WORKSPACE_RUN_TEST_SYSTEM: 'fail' });
  expect(failed.status).not.toBe(0);
  expect(failed.stderr).toContain('mise install failed');
  expect(run().status).toBe(0);
  expect(run().calls).toEqual([STOP, DEV]);
});

// regression: workspace-preparation-split-blocks-opening
test.each(['WORKSPACE_RUN_TEST_INSTALL', 'WORKSPACE_RUN_TEST_SYSTEM'])(
  'workspace creation reports %s failure and permits opening without stamping readiness',
  (failure) => {
    const { dir, prepare, run } = checkout();
    const result = prepare({ [failure]: 'fail' });
    expect(result.status).toBe(0);
    expect(result.stderr).toContain(
      '!!! environment preparation is incomplete'
    );
    expect(result.stdout).toContain('==> workspace may be opened');
    expect(
      existsSync(join(dir, 'node_modules/.workspace-install-fingerprint'))
    ).toBe(false);
    expect(run({ [failure]: 'fail' }).status).not.toBe(0);
    expect(run().calls).toEqual([INSTALL, STOP, DEV]);
  }
);

// regression: t3-storybook-nested-supervisor
test('Start stack delegates to the canonical stack without nesting a Storybook supervisor', () => {
  const { run } = checkout();
  const result = run();
  expect(result.status).toBe(0);
  expect(result.calls).toEqual([INSTALL, STOP, DEV]);
});

// regression: workspace-run-auto-setup
test('run repairs missing install tools and retries a failed automatic setup', () => {
  const { dir, setup, run } = checkout();
  setup();
  rmSync(join(dir, 'node_modules/.bin/turbo'));
  const failed = run({ WORKSPACE_RUN_TEST_INSTALL: 'partial' });
  expect(failed.status).not.toBe(0);
  expect(failed.calls).toEqual([INSTALL]);
  expect(
    existsSync(join(dir, 'node_modules/.workspace-install-fingerprint'))
  ).toBe(false);
  expect(run().calls).toEqual([INSTALL, STOP, DEV]);
  expect(run().calls).toEqual([STOP, DEV]);
});

// regression: workspace-fixture-git-config-absence
test('an absent hook configuration permits setup while a configured hooks path is refused', () => {
  const { setup } = checkout();
  const refused = setup({ WORKSPACE_RUN_TEST_HOOKS: 'present' });
  expect(refused.status).not.toBe(0);
  expect(refused.stderr).toContain('this repository prohibits git hooks');
  const allowed = setup();
  expect(allowed.status, allowed.stderr).toBe(0);
});

// regression: workspace-activation-hidden-prompt
test('activation cannot wait for input or resolve tools over the network', () => {
  const { dir, setup, run } = checkout();
  expect(setup().status).toBe(0);
  writeExecutable(
    join(dir, '.bin/mise'),
    '#!/usr/bin/env bash\n' +
      'if [ "$1" = env ]; then\n' +
      '  [ "${MISE_OFFLINE:-}" = 1 ] || exit 91\n' +
      '  [ "${MISE_AUTO_INSTALL:-}" = 0 ] || exit 92\n' +
      '  if read -r answer; then exit 93; fi\n' +
      'fi\nexit 0\n'
  );
  const result = run();
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toContain('activating installed workspace tools');
  expect(result.calls).toEqual([STOP, DEV]);
});

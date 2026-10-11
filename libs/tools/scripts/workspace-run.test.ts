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

const hooks = join(import.meta.dirname, '../workspace');
const DEV = 'bun run --silent dev -- --web-port 5800';
const INSTALL = 'bun install';
const SETUP_TASKS =
  'turbo run //#workspace:install //#workspace:hooks //#workspace:local-files' +
  ' --continue --env-mode=loose --output-logs=errors-only';

const checkouts: string[] = [];
afterEach(() => {
  for (const dir of checkouts.splice(0))
    rmSync(dir, { recursive: true, force: true });
});

/**
 * A throwaway checkout holding the real hooks, with `bun`, `git`, `mise` and
 * `turbo` replaced by recorders so a hook can be observed without installing
 * or booting. As a real install does, the recorded one brings turbo with it.
 */
function checkout() {
  const dir = mkdtempSync(join(tmpdir(), 'workspace-run-'));
  checkouts.push(dir);
  const calls = join(dir, '.calls');
  cpSync(hooks, join(dir, 'libs/tools/workspace'), { recursive: true });
  mkdirSync(join(dir, '.bin'));
  mkdirSync(join(dir, 'apps/product'), { recursive: true });
  writeFileSync(join(dir, 'bun.lock'), '{}\n');
  writeFileSync(join(dir, 'package.json'), '{"name":"root"}\n');
  writeFileSync(join(dir, 'apps/product/package.json'), '{"name":"app"}\n');
  writeFileSync(
    join(dir, '.bin/bun'),
    '#!/usr/bin/env bash\n' +
      'printf "bun %s\\n" "$*" >> "$WORKSPACE_RUN_TEST_CALLS"\n' +
      'if [ "$1" = "install" ]; then\n' +
      '  [ "${WORKSPACE_RUN_TEST_INSTALL:-ok}" = "ok" ] || exit 1\n' +
      '  mkdir -p node_modules/.bin\n' +
      '  printf "#!/usr/bin/env bash\\nprintf \\"turbo %%s\\\\n\\" \\"\\$*\\" >> \\"\\$WORKSPACE_RUN_TEST_CALLS\\"\\n" > node_modules/.bin/turbo\n' +
      '  chmod +x node_modules/.bin/turbo\n' +
      'fi\n',
    { mode: 0o755 }
  );
  writeFileSync(
    join(dir, '.bin/git'),
    '#!/usr/bin/env bash\n' +
      'case "$*" in\n' +
      '  config\\ -f\\ .gitmodules*)\n' +
      '    printf "submodule.%s.path %s\\n" vendor/atlas vendor/atlas vendor/held vendor/held ;;\n' +
      '  "diff --name-only --diff-filter=U -z")\n' +
      '    printf "%s" "${WORKSPACE_RUN_TEST_UNMERGED:-}" | tr "\\n" "\\0" ;;\n' +
      '  submodule\\ update*) printf "git %s\\n" "$*" >> "$WORKSPACE_RUN_TEST_CALLS" ;;\n' +
      // `vendor/held` against the commit the checkout records for it.
      '  "rev-parse -q --verify HEAD:vendor/held")\n' +
      '    [ -z "${WORKSPACE_RUN_TEST_HELD:-}" ] || echo recorded ;;\n' +
      '  "-C vendor/held rev-parse -q --verify HEAD") echo earlier ;;\n' +
      '  "-C vendor/held status --porcelain")\n' +
      '    [ "${WORKSPACE_RUN_TEST_HELD:-}" != "edited" ] || echo " M file" ;;\n' +
      '  "-C vendor/held merge-base --is-ancestor earlier recorded")\n' +
      '    [ "${WORKSPACE_RUN_TEST_HELD:-}" != "diverged" ] || exit 1 ;;\n' +
      'esac\n',
    { mode: 0o755 }
  );
  writeFileSync(
    join(dir, '.bin/mise'),
    '#!/usr/bin/env bash\n' +
      '[ "$1" = "install" ] && echo "mise: installing every tool"\n' +
      'exit 0\n',
    { mode: 0o755 }
  );
  const script = (name: string, args: readonly string[] = []) => {
    return (env: Record<string, string> = {}) => {
      rmSync(calls, { force: true });
      const result = spawnSync(
        'bash',
        [join(dir, 'libs/tools/workspace', name), ...args],
        {
          encoding: 'utf8',
          env: {
            ...process.env,
            ...env,
            PATH: `${join(dir, '.bin')}:${process.env['PATH'] ?? ''}`,
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
    step: (name: string) => script('step.sh', [name]),
  };
}

// regression: workspace-run-preflight-dependency-failure
test('Run launches dev directly on the workspace port', () => {
  const { run } = checkout();
  run();
  const result = run();
  expect(result.status).toBe(0);
  expect(result.calls).toEqual([DEV]);
});

test('Run installs first in a checkout that has no turbo to run dev with', () => {
  const { dir, run } = checkout();
  const first = run();
  expect(first.calls).toEqual([INSTALL, DEV]);
  // A step that worked is its one line.
  expect(first.stdout).toBe('==> bun install\n');
  expect(run().calls).toEqual([DEV]);

  rmSync(join(dir, 'node_modules'), { recursive: true });
  expect(run().calls).toEqual([INSTALL, DEV]);
});

test('Run launches dev on an incomplete install and retries it next time', () => {
  const { run } = checkout();
  const failing = [INSTALL, 'bun install --ignore-scripts', DEV];
  const first = run({ WORKSPACE_RUN_TEST_INSTALL: 'fail' });
  expect(first.status).toBe(0);
  expect(first.stdout).toContain('launching dev on an incomplete install');
  expect(first.calls).toEqual(failing);
  expect(run({ WORKSPACE_RUN_TEST_INSTALL: 'fail' }).calls).toEqual(failing);
  expect(run().calls).toEqual([INSTALL, DEV]);
});

test('Run checks out a submodule workspace that was never initialized', () => {
  const { dir, run } = checkout();
  run();
  writeFileSync(join(dir, '.gitmodules'), '');
  mkdirSync(join(dir, 'vendor/held'), { recursive: true });
  writeFileSync(join(dir, 'vendor/held/.git'), 'gitdir: elsewhere\n');
  expect(run().calls).toEqual([
    'git submodule update --init --recursive -- vendor/atlas',
    DEV,
  ]);
});

// regression: workspace-submodule-behind-recorded-commit
test('Run brings forward a submodule that only fell behind the recorded commit', () => {
  const { dir, run, step } = checkout();
  run();
  writeFileSync(join(dir, '.gitmodules'), '');
  mkdirSync(join(dir, 'vendor/held'), { recursive: true });
  writeFileSync(join(dir, 'vendor/held/.git'), 'gitdir: elsewhere\n');
  const forward = [
    'git submodule update --init --recursive -- vendor/atlas',
    'git submodule update --init --recursive -- vendor/held',
  ];
  expect(run({ WORKSPACE_RUN_TEST_HELD: 'behind' }).calls).toEqual([
    ...forward,
    DEV,
  ]);
  // The tools a submodule serves take the same step before they start.
  const launch = step('submodules')({ WORKSPACE_RUN_TEST_HELD: 'behind' });
  expect(launch.status).toBe(0);
  expect(launch.calls).toEqual(forward);

  // Local work on another commit is never moved.
  for (const held of ['edited', 'diverged']) {
    expect(run({ WORKSPACE_RUN_TEST_HELD: held }).calls).toEqual([
      forward[0]!,
      DEV,
    ]);
  }
});

// regression: workspace-run-stale-install
test('the install task reinstalls when package manifests changed since the last install', () => {
  const { dir, step } = checkout();
  const install = step('install');
  expect(install().calls).toEqual([INSTALL]);
  const current = install();
  expect(current.calls).toEqual([]);
  // Nothing to do prints nothing: the task's pane stays empty.
  expect(current.stdout + current.stderr).toBe('');

  writeFileSync(
    join(dir, 'apps/product/package.json'),
    '{"name":"app","dependencies":{"@libs/sub-shared":"workspace:*"}}\n'
  );
  expect(install().calls).toEqual([INSTALL]);
  expect(install().calls).toEqual([]);

  writeFileSync(join(dir, 'bun.lock'), '{"merged":true}\n');
  expect(install().calls).toEqual([INSTALL]);

  rmSync(join(dir, 'node_modules'), { recursive: true });
  expect(install().calls).toEqual([INSTALL]);
});

test('the install task fails while the install is incomplete', () => {
  const { step } = checkout();
  const install = step('install');
  const failed = install({ WORKSPACE_RUN_TEST_INSTALL: 'fail' });
  // Turborepo prints a task's output only when it fails.
  expect(failed.status).not.toBe(0);
  expect(failed.stdout).toContain('dependency install is still incomplete');
  expect(install().status).toBe(0);
});

test('the merge task names an unfinished merge before dev fails on it', () => {
  const { dir, step } = checkout();
  const merge = step('merge');
  writeFileSync(join(dir, 'resolved.ts'), 'export const merged = true;\n');
  writeFileSync(
    join(dir, 'conflicted.ts'),
    '<<<<<<< HEAD\nours\n=======\ntheirs\n>>>>>>> main\n'
  );
  const result = merge({
    WORKSPACE_RUN_TEST_UNMERGED: 'resolved.ts\nconflicted.ts\n',
  });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('merge in progress: 2 unmerged path(s)');
  expect(result.stderr).toContain('conflicted.ts');
  expect(result.stderr).not.toContain('      resolved.ts');

  const concluded = merge();
  expect(concluded.status).toBe(0);
  expect(concluded.stdout + concluded.stderr).toBe('');
});

test('Setup runs its steps as Turborepo tasks that print only on failure', () => {
  const { run, setup } = checkout();
  run();
  const result = setup();
  expect(result.status).toBe(0);
  expect(result.calls).toEqual([
    'git submodule update --init --recursive',
    SETUP_TASKS,
  ]);
  // The tools that ran before turbo could are one line each.
  expect(result.stdout).toBe(
    '==> mise install\n==> git submodule update --init --recursive\n'
  );
});

test('Setup runs the same steps itself before any install brought turbo', () => {
  const { setup } = checkout();
  const result = setup();
  expect(result.status).toBe(0);
  expect(result.calls).toEqual([
    'git submodule update --init --recursive',
    INSTALL,
  ]);
  expect(result.stdout).toBe(
    [
      '==> mise install',
      '==> git submodule update --init --recursive',
      '==> workspace:install',
      '==> workspace:hooks',
      '==> workspace:local-files',
      '',
    ].join('\n')
  );
  expect(setup().calls.at(-1)).toBe(SETUP_TASKS);
});

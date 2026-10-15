import { afterEach, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const hooks = join(import.meta.dirname, '../workspace');
const REPO_ROOT = join(import.meta.dirname, '../../..');
/** Git's own hook filenames. A tracked file with one of these names is a hook. */
const GIT_HOOK_NAMES = new Set([
  'applypatch-msg',
  'commit-msg',
  'fsmonitor-watchman',
  'post-applypatch',
  'post-checkout',
  'post-commit',
  'post-merge',
  'post-rewrite',
  'post-update',
  'pre-applypatch',
  'pre-auto-gc',
  'pre-commit',
  'pre-merge-commit',
  'pre-push',
  'pre-rebase',
  'pre-receive',
  'prepare-commit-msg',
  'push-to-checkout',
  'reference-transaction',
  'sendemail-validate',
]);
const DEV = 'bun run --silent dev -- --web-port 5800';
const INSTALL = 'bun install';

const checkouts: string[] = [];
afterEach(() => {
  for (const dir of checkouts.splice(0))
    rmSync(dir, { recursive: true, force: true });
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
  cpSync(hooks, join(dir, 'libs/tools/workspace'), { recursive: true });
  writeFakeTools(dir);
  mkdirSync(join(dir, 'apps/product'), { recursive: true });
  writeFileSync(join(dir, 'bun.lock'), '{}\n');
  writeFileSync(join(dir, 'mise.toml'), '[tools]\nbun = "1.4.3"\n');
  writeFileSync(join(dir, 'package.json'), '{"name":"root"}\n');
  writeFileSync(join(dir, 'apps/product/package.json'), '{"name":"app"}\n');
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
    step: (name: string) => script('step.sh', [name]),
  };
}

test('the repository has no git hooks', () => {
  const listed = spawnSync(
    'git',
    ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: REPO_ROOT, encoding: 'utf8' }
  );
  expect(listed.status).toBe(0);
  const hits = listed.stdout.split('\0').filter((path) => {
    const name = path.split('/').at(-1) ?? '';
    return GIT_HOOK_NAMES.has(name) && existsSync(join(REPO_ROOT, path));
  });
  expect(hits).toEqual([]);
  const pkg = readFileSync(join(REPO_ROOT, 'package.json'), 'utf8');
  expect(pkg).not.toContain('hooks:install');
  expect(pkg).not.toContain('core.hooksPath');
  const step = readFileSync(join(hooks, 'step.sh'), 'utf8');
  expect(step).not.toContain('hooksPath');
  expect(step).not.toContain('githooks');
});

// regression: workspace-run-turbo-ui-stream
test('Run starts dev in the terminal UI even when the parent asked for stream', () => {
  const { run } = checkout();
  const env = { TURBO_UI: 'stream', WORKSPACE_RUN_TEST_RECORD_UI: '1' };
  const cold = run(env);
  expect(cold.status).toBe(0);
  expect(cold.calls).toEqual([
    'bun install TURBO_UI=false',
    `${DEV} TURBO_UI=true`,
  ]);
  expect(run(env).calls).toEqual([`${DEV} TURBO_UI=true`]);
});

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
  expect(first.stdout).toBe(
    ['==> mise install', '==> bun install', ''].join('\n')
  );
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

// regression: workspace-cold-secrets-pull
test('a cold run still launches when the secrets pull fails, and a warm run skips it', () => {
  const { dir, run } = checkout();
  const root = join(dir, 'main-checkout');
  mkdirSync(join(root, '.git'), { recursive: true });
  const cold = run({ WORKSPACE_RUN_TEST_ROOT: root });
  expect(cold.status).toBe(0);
  expect(cold.calls).toContain('bun run secrets:pull');
  expect(cold.calls.at(-1)).toBe(DEV);
  expect(cold.stdout).toContain(
    'secrets:pull failed; continuing without the offline secrets cache'
  );
  expect(cold.stdout).toContain('no .cache/secrets in root checkout');
  expect(existsSync(join(dir, '.cache/workspace-warm'))).toBe(true);

  const warm = run({ WORKSPACE_RUN_TEST_ROOT: root });
  expect(warm.status).toBe(0);
  expect(warm.calls).toEqual([DEV]);
  expect(warm.stdout).toBe('==> mise install\n');
});

// regression: workspace-run-missing-system-tools
test('Run installs and activates system tools before app dependencies on cold and warm launches', () => {
  const { dir, run } = checkout();
  mkdirSync(join(dir, '.tools'));
  renameSync(join(dir, '.bin/bun'), join(dir, '.tools/bun'));
  const env = { WORKSPACE_RUN_TEST_RECORD_SYSTEM: '1' };
  const system = [
    'mise trust --quiet mise.toml',
    'mise install --yes',
    'mise env --shell bash',
  ];
  const cold = run(env);
  expect(cold.status).toBe(0);
  expect(cold.calls).toEqual([...system, INSTALL, DEV]);
  // The old warm marker must not hide pins introduced by a pull.
  writeFileSync(join(dir, 'mise.toml'), '[tools]\nbun = "1.4.4"\n');
  const warm = run(env);
  expect(warm.status).toBe(0);
  expect(warm.calls).toEqual([...system, DEV]);
});

test('Run bootstraps mise without a shell profile and reuses its user installation', () => {
  const { dir, run } = checkout();
  renameSync(join(dir, '.bin/mise'), join(dir, '.bin/mise-template'));
  writeExecutable(
    join(dir, '.bin/curl'),
    '#!/usr/bin/env bash\n' +
      'printf "curl %s\\n" "$*" >> "$WORKSPACE_RUN_TEST_CALLS"\n' +
      'while [ "$1" != "--output" ]; do shift; done\n' +
      'cat > "$2" <<\'INSTALLER\'\n' +
      'mkdir -p "$(dirname "$MISE_INSTALL_PATH")"\n' +
      'cp .bin/mise-template "$MISE_INSTALL_PATH"\n' +
      'INSTALLER\n'
  );
  const env = { WORKSPACE_RUN_TEST_RECORD_SYSTEM: '1' };
  const cold = run(env);
  expect(cold.status).toBe(0);
  expect(cold.calls[0]).toContain('https://mise.run --output ');
  expect(cold.calls.slice(1)).toEqual([
    'mise trust --quiet mise.toml',
    'mise install --yes',
    'mise env --shell bash',
    INSTALL,
    DEV,
  ]);
  expect(existsSync(join(dir, 'home/.local/bin/mise'))).toBe(true);
  expect(run(env).calls).toEqual(cold.calls.slice(1, -2).concat(DEV));
});

test('Run retries failed system setup in a warm workspace and still attempts dev', () => {
  const { run } = checkout();
  const failed = run({ WORKSPACE_RUN_TEST_SYSTEM: 'fail' });
  expect(failed.status).toBe(0);
  expect(failed.stdout).toContain('system tool setup is incomplete');
  expect(failed.calls.at(-1)).toBe(DEV);
  const recovered = run({ WORKSPACE_RUN_TEST_RECORD_SYSTEM: '1' });
  expect(recovered.status).toBe(0);
  expect(recovered.calls).toContain('mise install --yes');
  expect(recovered.stdout).not.toContain('incomplete');
});

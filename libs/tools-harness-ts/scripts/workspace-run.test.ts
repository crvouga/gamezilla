import { afterEach, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
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
      'if [ "$1" = "run" ] && [ "$2" = "secrets:pull" ]; then exit "${WORKSPACE_RUN_TEST_SECRETS_STATUS:-1}"; fi\n' +
      'if [ "$1" = "install" ]; then\n' +
      '  echo "bun: resolving packages" >&2\n' +
      '  [ "${WORKSPACE_RUN_TEST_INSTALL:-ok}" != "fail" ] || exit 1\n' +
      '  if [ -L node_modules/.bun/stale-link ]; then\n' +
      '    echo "EEXIST: File exists: failed to symlink dependencies for package: @babel/helper-module-transforms@7.29.7 (symlink)" >&2\n' +
      '    exit 1\n' +
      '  fi\n' +
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
      // Pinned tools still to install, in `mise ls --missing` columns.
      'if [ "$1" = "ls" ]; then printf "%b" "${WORKSPACE_RUN_TEST_MISSING-bun  1.4.3 (missing)  mise.toml  1.4.3\\n}"; fi\n' +
      'if [ "$1" = "install" ] && [ "${WORKSPACE_RUN_TEST_SYSTEM:-ok}" != "ok" ]; then exit 1; fi\n' +
      'if [ "$1" = "install" ] && [ -n "${WORKSPACE_RUN_TEST_PROMPT:-}" ] && read -r answer; then exit 94; fi\n' +
      '[ "$1" = "install" ] && echo "mise: downloading $*"\n' +
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
    return (env: Record<string, string> = {}, input?: string) => {
      rmSync(calls, { force: true });
      const result = spawnSync(
        'bash',
        [join(dir, 'libs/tools-harness-ts/workspace', name), ...args],
        {
          encoding: 'utf8',
          input,
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
    storybook: script('storybook.sh'),
    setup: script('setup.sh'),
    bootstrap: script('bootstrap.sh'),
    prepare: script('prepare.sh'),
    teardown: script('teardown.sh'),
    port: script('port.sh'),
    step: (name: string) => script('step.sh', [name]),
  };
}

// regression: localhost-install-output
test('Localhost sends cold install details to its linked log on success and failure', () => {
  const { dir, run } = checkout();
  const log = join(dir, '.cache/localhost-stack/dev.log');
  const failed = run({ WORKSPACE_RUN_TEST_INSTALL: 'fail' });
  expect(failed.status).toBe(1);
  expect(failed.stdout).toBe(`Failed (1) · Logs ${log}\n`);
  expect(failed.stderr).toBe('');
  expect(readFileSync(log, 'utf8')).toContain('bun: resolving packages');
  const started = run();
  expect(started.status).toBe(0);
  expect(started.stdout + started.stderr).toBe('');
  const details = readFileSync(log, 'utf8');
  expect(details).toContain('mise: downloading');
  expect(details).toContain('bun: resolving packages');
  expect(details).toContain('stopping any stack');
});

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
    'mise ls --current --missing --local',
    'mise install --yes bun',
    'mise env --shell bash',
    INSTALL,
  ]);
});

// regression: workspace-mise-install-hidden-hang
test('setup shows tool downloads and cannot wait on a hidden prompt', () => {
  const { setup } = checkout();
  // A terminal that would answer: only a closed stdin keeps mise from reading.
  const result = setup({ WORKSPACE_RUN_TEST_PROMPT: '1' }, 'y\n');
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toContain('mise: downloading install --yes bun');
  expect(result.stdout).toContain('==> installing pinned tools: bun');
});

// regression: workspace-mise-install-hidden-hang
test('setup installs only missing pinned tools and skips lazy ones', () => {
  const { setup } = checkout();
  const result = setup({
    WORKSPACE_RUN_TEST_RECORD_SYSTEM: '1',
    WORKSPACE_RUN_TEST_MISSING:
      'swift  6.4.0 (lazy)  mise.toml  6.4.0\\nhttp:alloy  6.2.0 (missing)  mise.toml  6.2.0\\n',
  });
  expect(result.status, result.stderr).toBe(0);
  expect(result.calls).toContain('mise install --yes http:alloy');
  const warm = setup({
    WORKSPACE_RUN_TEST_RECORD_SYSTEM: '1',
    WORKSPACE_RUN_TEST_MISSING: '',
  });
  expect(warm.status, warm.stderr).toBe(0);
  expect(warm.calls.some((call) => call.startsWith('mise install'))).toBe(
    false
  );
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

/**
 * A workstation whose mise config asks for a newer mise than is installed:
 * every mise command refuses until the binary is replaced. `curl` hands back
 * an installer that puts the working mise where the old one is.
 */
function outdatedMise(dir: string, download: 'ok' | 'offline'): void {
  renameReplacing(join(dir, '.bin/mise'), join(dir, '.bin/mise-new'));
  writeExecutable(
    join(dir, '.bin/mise'),
    '#!/usr/bin/env bash\n' +
      'echo "mise ERROR mise version 2026.11.11 is required, but you are using 2026.10.24" >&2\n' +
      'exit 1\n'
  );
  writeExecutable(
    join(dir, '.bin/curl'),
    download === 'offline'
      ? '#!/usr/bin/env bash\necho "curl: (6) Could not resolve host" >&2\nexit 6\n'
      : '#!/usr/bin/env bash\n' +
          'while [ "$#" -gt 0 ]; do\n' +
          '  if [ "$1" = "--output" ]; then out="$2"; fi\n' +
          '  shift\n' +
          'done\n' +
          'cat > "$out" <<\'INSTALLER\'\n' +
          'printf "%s\\n" "$MISE_VERSION" > "$(dirname "$MISE_INSTALL_PATH")/../.mise-installed"\n' +
          'cp "$(dirname "$MISE_INSTALL_PATH")/mise-new" "$MISE_INSTALL_PATH"\n' +
          'INSTALLER\n'
  );
}

// regression: workspace-run-outdated-mise
test('Localhost updates a mise older than a config requires, then starts', () => {
  const { dir, run } = checkout();
  outdatedMise(dir, 'ok');
  const result = run();
  expect(result.status, result.stderr).toBe(0);
  expect(readFileSync(join(dir, '.mise-installed'), 'utf8').trim()).toBe(
    'v2026.11.11'
  );
  expect(result.calls).toEqual([INSTALL, STOP, DEV]);
  // Up to date now: the next launch updates nothing.
  rmSync(join(dir, '.mise-installed'));
  expect(run().calls).toEqual([STOP, DEV]);
  expect(existsSync(join(dir, '.mise-installed'))).toBe(false);
});

// regression: workspace-run-outdated-mise
test('an outdated mise that cannot be updated says which version is needed', () => {
  const { dir, run } = checkout();
  outdatedMise(dir, 'offline');
  const result = run();
  expect(result.status).not.toBe(0);
  expect(
    readFileSync(join(dir, '.cache/localhost-stack/dev.log'), 'utf8')
  ).toContain(
    '!!! mise 2026.11.11 is required and could not be installed over'
  );
  expect(result.calls).toEqual([]);
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
  expect(
    readFileSync(join(dir, '.cache/localhost-stack/dev.log'), 'utf8')
  ).toContain('activating installed workspace tools');
  expect(result.calls).toEqual([STOP, DEV]);
});

// regression: t3-action-stale-bun-links
test('Localhost rebuilds a conflicting Bun link before it starts the stack', () => {
  const { dir, run } = checkout();
  mkdirSync(join(dir, 'node_modules/.bun'), { recursive: true });
  symlinkSync('missing', join(dir, 'node_modules/.bun/stale-link'));
  const result = run();
  expect(result.status, result.stderr).toBe(0);
  expect(result.calls).toEqual([INSTALL, INSTALL, STOP, DEV]);
  expect(
    readFileSync(join(dir, '.cache/localhost-stack/dev.log'), 'utf8')
  ).toContain('rebuilding conflicting Bun dependency links');
  expect(run().calls).toEqual([STOP, DEV]);
});

// regression: t3-preview-locked-tools
test('Storybook prepares a cold worktree with no mise.lock before it starts', () => {
  const { dir, storybook } = checkout();
  writeExecutable(
    join(dir, '.bin/mise'),
    `#!/usr/bin/env bash
[ "$MISE_LOCKED" = false ] && [ "$MISE_LOCKFILE" = false ] || exit 1
if [ "$1" = env ]; then echo 'export PATH="$PWD/.bin:$PATH"'; fi
`
  );
  const result = storybook({ MISE_LOCKED: 'true', MISE_LOCKFILE: 'true' });
  expect(result.status, result.stderr).toBe(0);
  expect(result.calls).toEqual([INSTALL, 'bun run --silent storybook']);
});

// regression: workspace-bootstrap-cache-brand-check
test('bootstrap configures the cache without preparing product branding', () => {
  const { dir, bootstrap } = checkout();
  writeExecutable(join(dir, '.bin/gh'), '#!/usr/bin/env bash\nexit 0\n');
  const result = bootstrap({
    WORKSPACE_RUN_TEST_SECRETS_STATUS: '0',
    XDG_CONFIG_HOME: join(dir, 'config'),
  });
  expect(result.status, result.stderr).toBe(0);
  expect(result.calls.join(' ')).toContain(
    'secrets-run.ts --fixture --isolated -- bun -e'
  );
});

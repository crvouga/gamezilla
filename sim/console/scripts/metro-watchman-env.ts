import { spawnSync } from 'node:child_process';

function probeWatchmanProject(watchRoot: string): boolean {
  const probe = spawnSync('watchman', ['watch-project', watchRoot], {
    encoding: 'utf8',
  });
  const combined = `${probe.stdout ?? ''}${probe.stderr ?? ''}`;
  return (
    probe.status === 0 &&
    !/error|failed|shutting down|FSEventStreamStart failed/i.test(combined)
  );
}

function primeWatchmanRoots(clientRoot: string, monorepoRoot: string): boolean {
  if (!probeWatchmanProject(clientRoot)) {
    return false;
  }
  if (!probeWatchmanProject(monorepoRoot)) {
    process.stderr.write(
      '[setup-env] Watchman on apps/client OK but monorepo root failed — Metro may miss Bun store SHA-1.\n'
    );
  }
  return true;
}

function isCi(): boolean {
  return (
    process.env['CI'] === 'true' || process.env['GITHUB_ACTIONS'] === 'true'
  );
}

/**
 * Value written to `.env.local` as `EXPO_USE_WATCHMAN` for Metro.
 *
 * Always re-probes Watchman. Do not early-return on `EXPO_USE_WATCHMAN=0` from
 * the environment: Bun auto-loads the `.env.local` we are about to rewrite, so
 * a previous failed probe (Watchman missing) would permanently pin Watchman off
 * after install. Explicit opt-out while Watchman works: uninstall Watchman or
 * make `watchman watch-project` fail for `apps/client`.
 */
export function resolveExpoUseWatchmanForSetup(args: {
  readonly clientRoot: string;
  readonly monorepoRoot: string;
}): '0' | '1' {
  const required = process.env['EXPO_USE_WATCHMAN'] === '1';
  const primed = primeWatchmanRoots(args.clientRoot, args.monorepoRoot);
  if (primed) {
    return '1';
  }
  // CI jobs that set EXPO_USE_WATCHMAN=1 need Watchman for Bun-store SHA-1.
  // Silently writing 0 leaves Metro unable to hash `node_modules` symlinks.
  if (required && isCi()) {
    throw new Error(
      '[setup-env] EXPO_USE_WATCHMAN=1 but Watchman watch-project failed for apps/client. ' +
        'Install Watchman (CI setup action watchman: true) and ensure watchman watch-project works.'
    );
  }
  return '0';
}

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

/** Value written to `.env.local` as `EXPO_USE_WATCHMAN` for Metro. */
export function resolveExpoUseWatchmanForSetup(args: {
  readonly clientRoot: string;
  readonly monorepoRoot: string;
}): '0' | '1' {
  if (process.env['EXPO_USE_WATCHMAN'] === '0') {
    return '0';
  }
  if (process.env['EXPO_USE_WATCHMAN'] === '1') {
    return primeWatchmanRoots(args.clientRoot, args.monorepoRoot) ? '1' : '0';
  }
  return primeWatchmanRoots(args.clientRoot, args.monorepoRoot) ? '1' : '0';
}

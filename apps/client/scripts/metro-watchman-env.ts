import { spawnSync } from 'node:child_process';

type ConfigureMetroWatchmanEnvArgs = {
  readonly monorepoRoot: string;
  readonly clientRoot: string;
  readonly baseEnv?: NodeJS.ProcessEnv;
};

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
  // Bun deps resolve into `node_modules/.bun`; Metro needs those paths indexed
  // for SHA-1 while keeping `apps/client/node_modules` symlinks for dedupe.
  if (!probeWatchmanProject(monorepoRoot)) {
    process.stderr.write(
      '[client-dev] Watchman on apps/client OK but monorepo root failed — Metro may miss Bun store SHA-1.\n'
    );
  }
  return true;
}

/**
 * Prefer Watchman on `apps/client` only. The monorepo root is too large for
 * reliable FSEvents watches on macOS; Node crawl fallback must not watch
 * `node_modules` (Bun symlinks fan out into `node_modules/.bun` and EMFILE).
 */
export function configureMetroWatchmanEnv(
  args: ConfigureMetroWatchmanEnvArgs
): NodeJS.ProcessEnv {
  const { baseEnv = process.env } = args;
  const env = { ...baseEnv };

  if (env['EXPO_USE_WATCHMAN'] === '0') {
    process.stderr.write(
      '[client-dev] Metro Node file crawl (EXPO_USE_WATCHMAN=0).\n'
    );
    return env;
  }

  if (env['EXPO_USE_WATCHMAN'] === '1') {
    if (!primeWatchmanRoots(args.clientRoot, args.monorepoRoot)) {
      process.stderr.write(
        '[client-dev] EXPO_USE_WATCHMAN=1 but Watchman probe failed — using Node file crawl.\n'
      );
      env['EXPO_USE_WATCHMAN'] = '0';
    }
    return env;
  }

  if (primeWatchmanRoots(args.clientRoot, args.monorepoRoot)) {
    env['EXPO_USE_WATCHMAN'] = '1';
    process.stderr.write(
      '[client-dev] Metro Watchman enabled (apps/client + monorepo root).\n'
    );
    return env;
  }

  env['EXPO_USE_WATCHMAN'] = '0';
  process.stderr.write(
    '[client-dev] Watchman unavailable — Metro Node file crawl (install/start Watchman or set EXPO_USE_WATCHMAN=1 after fixing it).\n'
  );
  return env;
}

import { spawnSync } from 'node:child_process';

type ConfigureMetroWatchmanEnvArgs = {
  readonly monorepoRoot: string;
  readonly clientRoot: string;
  readonly baseEnv?: NodeJS.ProcessEnv;
};

/** Returns env with `EXPO_USE_WATCHMAN` set (Watchman is opt-in only). */
export function configureMetroWatchmanEnv(
  args: ConfigureMetroWatchmanEnvArgs
): NodeJS.ProcessEnv {
  const { baseEnv = process.env } = args;
  const env = { ...baseEnv };
  if (env['EXPO_USE_WATCHMAN'] === '1') {
    const probe = spawnSync('watchman', ['watch-project', args.monorepoRoot], {
      encoding: 'utf8',
    });
    const combined = `${probe.stdout ?? ''}${probe.stderr ?? ''}`;
    const ok =
      probe.status === 0 &&
      !/error|failed|shutting down|FSEventStreamStart failed/i.test(combined);
    if (!ok) {
      process.stderr.write(
        '[client-dev] EXPO_USE_WATCHMAN=1 but Watchman probe failed — using Node file crawl.\n'
      );
      env['EXPO_USE_WATCHMAN'] = '0';
    }
    return env;
  }

  env['EXPO_USE_WATCHMAN'] = '0';
  process.stderr.write(
    '[client-dev] Metro Node file crawl (EXPO_USE_WATCHMAN=1 to opt in to Watchman).\n'
  );
  return env;
}

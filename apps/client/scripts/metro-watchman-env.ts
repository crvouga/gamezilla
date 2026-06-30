import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

function watchmanIgnoresNodeModules(monorepoRoot: string): boolean {
  const configPath = path.join(monorepoRoot, '.watchmanconfig');
  if (!fs.existsSync(configPath)) {
    return false;
  }
  try {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
      ignore_dirs?: string[];
    };
    return config.ignore_dirs?.includes('node_modules') ?? false;
  } catch {
    return false;
  }
}

/** Returns env with `EXPO_USE_WATCHMAN` set after probing the local Watchman daemon. */
export function configureMetroWatchmanEnv(
  monorepoRoot: string,
  baseEnv: NodeJS.ProcessEnv = process.env
): NodeJS.ProcessEnv {
  const env = { ...baseEnv };
  if (env['EXPO_USE_WATCHMAN'] === '0') {
    return env;
  }

  if (watchmanIgnoresNodeModules(monorepoRoot)) {
    process.stderr.write(
      '[client-dev] .watchmanconfig ignores node_modules — Metro will use Node file crawl.\n'
    );
    env['EXPO_USE_WATCHMAN'] = '0';
    return env;
  }

  const probe = spawnSync('watchman', ['watch-project', monorepoRoot], {
    encoding: 'utf8',
  });
  const combined = `${probe.stdout ?? ''}${probe.stderr ?? ''}`;
  let watchmanError: string | undefined;
  try {
    const parsed = JSON.parse(probe.stdout ?? '') as { error?: string };
    if (typeof parsed.error === 'string' && parsed.error.length > 0) {
      watchmanError = parsed.error;
    }
  } catch {
    // Non-JSON output — fall through to regex heuristics below.
  }
  const ok =
    probe.status === 0 &&
    watchmanError === undefined &&
    !/error|failed|shutting down|FSEventStreamStart failed/i.test(combined);

  if (ok) {
    env['EXPO_USE_WATCHMAN'] = '1';
    process.stderr.write(
      '[client-dev] Watchman OK — Metro will use Watchman for file crawl.\n'
    );
    return env;
  }

  if (env['EXPO_USE_WATCHMAN'] === '1') {
    process.stderr.write(
      '[client-dev] EXPO_USE_WATCHMAN=1 but Watchman probe failed — falling back to Node file crawl.\n'
    );
  } else {
    process.stderr.write(
      '[client-dev] Watchman unavailable — Metro will use Node file crawl (EXPO_USE_WATCHMAN=0).\n' +
        '  To repair: watchman shutdown-server && watchman watch-project .\n'
    );
  }
  env['EXPO_USE_WATCHMAN'] = '0';
  return env;
}

import { existsSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** Must match `cacheStores` root in `apps/client/metro.config.js`. */
export function metroCacheRoot(clientRoot: string): string {
  return join(clientRoot, 'node_modules', '.cache', 'metro');
}

/** Opt-in cache reset: `EXPO_DEV_CLEAR=1 bun dev`. */
export function maybeClearMetroCache(clientRoot: string): void {
  if (process.env['EXPO_DEV_CLEAR'] !== '1') return;
  const root = metroCacheRoot(clientRoot);
  if (!existsSync(root)) return;
  rmSync(root, { recursive: true, force: true });
  process.stderr.write(`[client-dev] cleared metro cache at ${root}\n`);
}

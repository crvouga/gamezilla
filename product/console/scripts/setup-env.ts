// @io-wall-ok — composition-root wall FS for Expo env (sim-console).
/**
 * Minimal `.env.local` for the sim-console Expo shell. Playground uses
 * in-process sim URLs; product embeds do not need a live API origin.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveExpoUseWatchmanForSetup } from './metro-watchman-env';

const appRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const monorepoRoot = join(appRoot, '../..');
const outPath = join(appRoot, '.env.local');

const expoUseWatchman = resolveExpoUseWatchmanForSetup({
  clientRoot: appRoot,
  monorepoRoot,
});

const lines = [
  'EXPO_PUBLIC_API_URL=http://localhost:8787',
  `EXPO_USE_WATCHMAN=${expoUseWatchman}`,
];

writeFileSync(outPath, `${lines.join('\n')}\n`, 'utf8');
process.stdout.write(`[sim-console] wrote ${outPath}\n`);

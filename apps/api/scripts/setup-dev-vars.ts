/**
 * Trust boundary: `process.env` (e.g. from `doppler run --`) → `apps/api/.dev.vars`
 * for `wrangler dev`. Writes **only** `DOPPLER_TOKEN`; all other API config
 * (including `DATABASE_URL`) is resolved at runtime via SecretStore.
 */

import { DopplerCli } from '@gamezilla/lib/doppler';
import { renameSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(apiRoot, '.dev.vars');
const tmpPath = `${outPath}.${process.pid}.tmp`;

function encodeDevVarValue(value: string): string {
  return `"${value
    .replaceAll('\\', '\\\\')
    .replaceAll('"', '\\"')
    .replaceAll('\n', '\\n')}"`;
}

function resolveDopplerToken(): string {
  try {
    const resolved = new DopplerCli().resolveToken();
    if (resolved.source === 'cli') {
      process.stdout.write(
        '[setup-dev-vars] DOPPLER_TOKEN not set in env; using `doppler configure get token --plain`.\n'
      );
    }
    return resolved.token;
  } catch {
    // handled by fatal message below
  }

  process.stderr.write(
    '[setup-dev-vars] DOPPLER_TOKEN is required. Set it in env, or login/configure Doppler CLI so `doppler configure get token --plain` succeeds.\n'
  );
  process.exit(1);
}

async function main(): Promise<void> {
  const dopplerToken = resolveDopplerToken();
  const lines: string[] = [`DOPPLER_TOKEN=${encodeDevVarValue(dopplerToken)}`];

  const body = `${lines.join('\n')}\n`;
  writeFileSync(tmpPath, body, { encoding: 'utf8' });
  renameSync(tmpPath, outPath);

  process.stdout.write(
    `[setup-dev-vars] wrote .dev.vars with keys: ${lines
      .map((l) => l.split('=')[0])
      .join(', ')}\n`
  );
}

await main();

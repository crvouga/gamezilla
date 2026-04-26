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

function defaultLocalDbHttpUrl(): string {
  const raw = process.env['SQL_PORT'];
  const port =
    typeof raw === 'string' && raw.trim().length > 0 ? raw.trim() : '15432';
  return `http://127.0.0.1:${port}`;
}

function resolveDbUrlFromEnv(): string {
  const raw = process.env['DB_URL'];
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim();
  }
  const url = defaultLocalDbHttpUrl();
  process.stdout.write(
    `[setup-dev-vars] DB_URL unset; using local @gamezilla/db HTTP URL ${url} (same default as apps/db server; set DB_URL or SQL_PORT to override).\n`
  );
  return url;
}

async function main(): Promise<void> {
  const dopplerToken = resolveDopplerToken();
  const dbUrl = resolveDbUrlFromEnv();
  const lines: string[] = [
    `DOPPLER_TOKEN=${encodeDevVarValue(dopplerToken)}`,
    `DB_URL=${encodeDevVarValue(dbUrl)}`,
  ];

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

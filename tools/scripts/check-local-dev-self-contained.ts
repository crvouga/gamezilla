// @io-wall-ok — tools composition root
/**
 * Guard: `bun dev` is `@apps/client` only (Main + Console playground) — no
 * sidecar apps, no Wrangler/API `dev` scripts.
 */

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '../..');

function readJson(rel: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(repoRoot, rel), 'utf8')) as Record<
    string,
    unknown
  >;
}

function main(): void {
  const root = readJson('package.json');
  const scripts = root['scripts'] as Record<string, string>;
  const dev = scripts['dev'] ?? '';
  if (!dev.includes('--filter=@apps/client')) {
    throw new Error(
      `root "dev" must filter @apps/client (got ${JSON.stringify(dev)})`
    );
  }

  const client = readJson('apps/client/package.json');
  const clientScripts = client['scripts'] as Record<string, string> | undefined;
  if (clientScripts === undefined || !('dev' in clientScripts)) {
    throw new Error('apps/client must define a daily "dev" script');
  }

  for (const pkg of ['apps/server', 'apps/room'] as const) {
    const json = readJson(`${pkg}/package.json`);
    const pkgScripts = json['scripts'] as Record<string, string> | undefined;
    if (pkgScripts !== undefined && 'dev' in pkgScripts) {
      throw new Error(`${pkg} must not define a daily "dev" script`);
    }
  }

  for (const gone of [
    'apps/system',
    'apps/postgres',
    'apps/minio',
    'apps/emqx',
  ] as const) {
    try {
      readJson(`${gone}/package.json`);
      throw new Error(`${gone} must not exist`);
    } catch (error) {
      if (error instanceof Error && error.message.includes('must not exist')) {
        throw error;
      }
    }
  }

  console.log(
    'ci:local-dev-self-contained: bun dev is @apps/client only; sidecar apps removed.'
  );
}

try {
  main();
} catch (error) {
  console.error(
    `ci:local-dev-self-contained: ${error instanceof Error ? error.message : String(error)}`
  );
  process.exit(1);
}

// @io-wall-ok — tools composition root
/**
 * Guard: `bun dev` is `@sim/console` only (Reports + Playground) — no
 * sidecar apps, no Wrangler/API `dev` scripts. Product client is `dev:client`.
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
  if (!dev.includes('--filter=@sim/console')) {
    throw new Error(
      `root "dev" must filter @sim/console (got ${JSON.stringify(dev)})`
    );
  }
  const devClient = scripts['dev:client'] ?? '';
  if (!devClient.includes('--filter=@apps/client')) {
    throw new Error(
      `root "dev:client" must filter @apps/client (got ${JSON.stringify(devClient)})`
    );
  }

  const consolePkg = readJson('sim/console/package.json');
  const consoleScripts = consolePkg['scripts'] as
    | Record<string, string>
    | undefined;
  if (consoleScripts === undefined || !('dev' in consoleScripts)) {
    throw new Error('sim/console must define a daily "dev" script');
  }

  const client = readJson('apps/client/package.json');
  const clientScripts = client['scripts'] as Record<string, string> | undefined;
  if (clientScripts === undefined || !('dev' in clientScripts)) {
    throw new Error('apps/client must define a "dev" script for dev:client');
  }

  for (const pkg of ['apps/server', 'apps/room-server'] as const) {
    const json = readJson(`${pkg}/package.json`);
    const pkgScripts = json['scripts'] as Record<string, string> | undefined;
    if (pkgScripts !== undefined && 'dev' in pkgScripts) {
      throw new Error(`${pkg} must not define a daily "dev" script`);
    }
  }

  for (const gone of ['apps/postgres', 'apps/minio', 'apps/emqx'] as const) {
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
    'ci:local-dev-self-contained: bun dev is @sim/console only; sidecar apps removed.'
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

#!/usr/bin/env bun
// @io-wall-ok — verification CLI entry (scripts/**).
/**
 * `verify:rendered-worker`: dry-run `wrangler deploy` on the config Release
 * renders for each environment, not on the committed `wrangler.toml`.
 *
 * The committed file is env-agnostic. What Release ships is that file rendered
 * for an environment: its name and vars, the Hyperdrive binding, the placement
 * beside the database. `verify:worker-bundle` bundles the committed file, so a
 * mistake in the rendering (a field wrangler rejects, a binding it cannot
 * resolve) first met wrangler in Release. This renders every environment the
 * way `libs/infra-server-ts/scripts/worker-deploy.ts` does and has wrangler
 * validate each, offline: no Cloudflare credentials, the ids OpenTofu mints at
 * deploy time stand in as placeholders.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ENV_FILES } from '@libs/infra-shared-ts/envs';
import type { WranglerConfig } from '@libs/infra-shared-ts/wrangler';
import { renderWranglerConfig } from '@libs/infra-shared-ts/wrangler';
import { removeTree } from '@pkgs/os-server-ts/remove-tree';

const PACKAGE_DIR = join(import.meta.dir, '..');
/** OpenTofu mints the real id at deploy time; any 32 hex digits are well formed. */
const PLACEHOLDER_HYPERDRIVE_ID = '0'.repeat(32);

const base = Bun.TOML.parse(
  readFileSync(join(PACKAGE_DIR, 'wrangler.toml'), 'utf8')
) as WranglerConfig;
// The config is written one directory below the package, as Release writes it,
// because rendering re-roots the entry point and assets by one level.
const cacheDir = join(PACKAGE_DIR, '.cache');
mkdirSync(cacheDir, { recursive: true });
const outDir = join(cacheDir, 'rendered-worker-bundle');

let failed = false;
for (const [name, env] of Object.entries(ENV_FILES)) {
  const config = join(cacheDir, `wrangler.rendered-${name}.json`);
  writeFileSync(
    config,
    JSON.stringify(
      renderWranglerConfig(base, env, {
        hyperdriveId: PLACEHOLDER_HYPERDRIVE_ID,
      }),
      null,
      2
    )
  );
  removeTree(outDir);
  const result = spawnSync(
    'wrangler',
    ['deploy', '--dry-run', '--config', config, '--outdir', outDir],
    {
      cwd: PACKAGE_DIR,
      encoding: 'utf8',
      env: { ...process.env, WRANGLER_SEND_METRICS: 'false' },
    }
  );
  rmSync(config, { force: true });
  if (result.status !== 0) {
    process.stderr.write(result.stdout + result.stderr);
    console.error(`rendered worker: wrangler rejects the ${name} config`);
    failed = true;
  } else {
    console.log(`rendered worker: ${name} config accepted by wrangler`);
  }
}
removeTree(outDir);
process.exit(failed ? 1 : 0);

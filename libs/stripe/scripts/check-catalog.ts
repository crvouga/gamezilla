/**
 * CI: require Doppler-resolvable `STRIPE_SECRET_KEY`, run catalog sync.
 *
 * Local: if Doppler token cannot be resolved or key is unset, skip catalog sync.
 */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { StripeSecretKeys } from '../src/secret-keys';
import { createStripeScriptSecretStore } from '../src/script-secret-store';

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), '..');

function isCi(): boolean {
  const ci = process.env['CI'];
  return (
    ci === 'true' || ci === '1' || process.env['GITHUB_ACTIONS'] === 'true'
  );
}

function runCatalogSync(): number {
  const syncScript = join(pkgRoot, 'scripts', 'sync-catalog.ts');
  const proc = Bun.spawnSync(['bun', syncScript], {
    cwd: pkgRoot,
    env: process.env,
    stdio: ['inherit', 'inherit', 'inherit'],
  });
  return proc.exitCode ?? 1;
}

async function main(): Promise<void> {
  let store;
  try {
    store = createStripeScriptSecretStore();
  } catch {
    if (isCi()) {
      console.error(
        '[stripe check] CI needs DOPPLER_TOKEN (or Doppler CLI login) so catalog sync can load secrets'
      );
      process.exit(1);
    }
    console.log(
      '[stripe check] skip catalog sync — could not resolve Doppler token (set DOPPLER_TOKEN or run `doppler login`)'
    );
    return;
  }

  let trimmed = '';
  try {
    const key = await store.getOptional(StripeSecretKeys.secretKey);
    trimmed = typeof key === 'string' ? key.trim() : '';
  } catch (e: unknown) {
    if (isCi()) {
      console.error(
        '[stripe check] CI: failed to read STRIPE_SECRET_KEY from Doppler',
        e instanceof Error ? e.message : String(e)
      );
      process.exit(1);
    }
    console.log(
      '[stripe check] skip catalog sync — Doppler request failed (set DOPPLER_CONFIG=local and ensure secrets exist):',
      e instanceof Error ? e.message : String(e)
    );
    return;
  }

  if (trimmed.length === 0) {
    if (isCi()) {
      console.error(
        '[stripe check] CI needs STRIPE_SECRET_KEY in Doppler for catalog sync'
      );
      process.exit(1);
    }
    console.log(
      '[stripe check] skip catalog sync — STRIPE_SECRET_KEY missing in Doppler'
    );
    return;
  }

  const syncExit = runCatalogSync();
  if (syncExit !== 0) {
    process.exit(syncExit);
  }
}

await main();

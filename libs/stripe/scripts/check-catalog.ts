/**
 * CI gate: run catalog reconcile only — no patch-db dump, no webhook mutation.
 *
 * - CI (`CI=true` / `GITHUB_ACTIONS=true`): require Doppler-resolvable
 *   `STRIPE_SECRET_KEY`; fail loudly if missing.
 * - Local: silently skip when Doppler / `STRIPE_SECRET_KEY` is unavailable so
 *   the dev workflow doesn't block on a dashboard-only secret.
 *
 * Catalog dump to patch-db is intentionally skipped here — the gate's job is
 * to verify the SPEC reconciles cleanly, not to mutate any local DB.
 */
import { StripeSecretKeys } from '../src/secret-keys';
import { createStripeClientFromSecret } from '../src/script-runtime';
import { createStripeScriptSecretStore } from '../src/script-secret-store';
import { runStripeCatalogSync } from '../src/sync';

const SCRIPT_TAG = 'stripe check';

function isCi(): boolean {
  const ci = process.env['CI'];
  return (
    ci === 'true' || ci === '1' || process.env['GITHUB_ACTIONS'] === 'true'
  );
}

async function resolveStripeSecretOrSkip(): Promise<string | null> {
  let store;
  try {
    store = createStripeScriptSecretStore();
  } catch {
    if (isCi()) {
      console.error(
        `[${SCRIPT_TAG}] CI needs DOPPLER_TOKEN (or Doppler CLI login) so catalog sync can load secrets`
      );
      process.exit(1);
    }
    console.log(
      `[${SCRIPT_TAG}] skip catalog sync — could not resolve Doppler token (set DOPPLER_TOKEN or run \`doppler login\`)`
    );
    return null;
  }

  let trimmed = '';
  try {
    const raw = await store.getOptional(StripeSecretKeys.secretKey);
    trimmed = typeof raw === 'string' ? raw.trim() : '';
  } catch (e: unknown) {
    if (isCi()) {
      console.error(
        `[${SCRIPT_TAG}] CI: failed to read STRIPE_SECRET_KEY from Doppler`,
        e instanceof Error ? e.message : String(e)
      );
      process.exit(1);
    }
    console.log(
      `[${SCRIPT_TAG}] skip catalog sync — Doppler request failed (set DOPPLER_CONFIG=local and ensure secrets exist):`,
      e instanceof Error ? e.message : String(e)
    );
    return null;
  }

  if (trimmed.length === 0) {
    if (isCi()) {
      console.error(
        `[${SCRIPT_TAG}] CI needs STRIPE_SECRET_KEY in Doppler for catalog sync`
      );
      process.exit(1);
    }
    console.log(
      `[${SCRIPT_TAG}] skip catalog sync — STRIPE_SECRET_KEY missing in Doppler`
    );
    return null;
  }

  return trimmed;
}

async function main(): Promise<void> {
  const secret = await resolveStripeSecretOrSkip();
  if (secret === null) return;
  const stripe = createStripeClientFromSecret(secret);
  await runStripeCatalogSync({ stripe });
  console.log(`[${SCRIPT_TAG}] catalog sync ok`);
}

await main().catch((e: unknown) => {
  console.error(
    `[${SCRIPT_TAG}] failed`,
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});

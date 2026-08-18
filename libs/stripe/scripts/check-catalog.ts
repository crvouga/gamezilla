/**
 * CI gate: run catalog reconcile only — no DB mutation.
 *
 * - CI (`CI=true` / `GITHUB_ACTIONS=true`): require secret store-resolvable
 *   `STRIPE_SECRET_KEY`; fail loudly if missing.
 * - Local: silently skip when secret store / `STRIPE_SECRET_KEY` is unavailable so
 *   the dev workflow doesn't block on a dashboard-only secret.
 */

import { cliIo } from '@libs/infra/cli/lib/cli-io';
import { createStripeClientFromSecret } from '../src/shared/stripe/script-runtime';
import { createStripeScriptSecretStore } from '../src/shared/stripe/script-secret-store';
import { StripeSecretKeys } from '../src/shared/stripe/secret-keys';
import { StripeCatalogSync } from '../src/use-cases/sync-catalog/server/sync';

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
    store = await createStripeScriptSecretStore({
      fetchFn: cliIo.http.fetch.bind(cliIo.http),
      now: cliIo.clock.now,
    });
  } catch {
    if (isCi()) {
      console.error(
        `[${SCRIPT_TAG}] CI needs SECRETS_TOKEN (or secret store CLI login) so catalog sync can load secrets`
      );
      process.exit(1);
    }
    console.log(
      `[${SCRIPT_TAG}] skip catalog sync — could not resolve secret store token (set SECRETS_TOKEN or run secrets CLI login)`
    );
    return null;
  }

  let trimmed: string;
  try {
    const raw = (
      await store.getOptional(StripeSecretKeys.secretKey)
    )?.readSecretValue();
    trimmed = typeof raw === 'string' ? raw.trim() : '';
  } catch (e: unknown) {
    if (isCi()) {
      console.error(
        `[${SCRIPT_TAG}] CI: failed to read STRIPE_SECRET_KEY from secret store`,
        e instanceof Error ? e.message : String(e)
      );
      process.exit(1);
    }
    console.log(
      `[${SCRIPT_TAG}] skip catalog sync — secret store request failed (set SECRETS_ENV=dev and ensure secrets exist):`,
      e instanceof Error ? e.message : String(e)
    );
    return null;
  }

  if (trimmed.length === 0) {
    if (isCi()) {
      console.error(
        `[${SCRIPT_TAG}] CI needs STRIPE_SECRET_KEY in secret store for catalog sync`
      );
      process.exit(1);
    }
    console.log(
      `[${SCRIPT_TAG}] skip catalog sync — STRIPE_SECRET_KEY missing in secret store`
    );
    return null;
  }

  return trimmed;
}

async function main(): Promise<void> {
  const secret = await resolveStripeSecretOrSkip();
  if (secret === null) return;
  const stripe = createStripeClientFromSecret(secret);
  await new StripeCatalogSync(stripe).run();
  console.log(`[${SCRIPT_TAG}] catalog sync ok`);
}

await main().catch((e: unknown) => {
  console.error(
    `[${SCRIPT_TAG}] failed`,
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});

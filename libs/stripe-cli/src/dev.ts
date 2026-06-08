/**
 * Local Stripe webhook forwarder: `stripe listen` → API `/stripe/webhook`,
 * then writes the CLI signing secret to Vault `dev` as STRIPE_WEBHOOK_SECRET.
 *
 * Run from monorepo root (`bun run dev` / turbo) so Vault project scope matches.
 */
import { createVaultSecretStoreForScripts } from '@pkgs/secret-store';
import { StripeSecretKeys } from '@libs/stripe/secret-keys';
import { exitUnlessLocalApiUrl } from './api-url-guard';
import { STRIPE_CLI_LOG_TAG } from './constants';
import {
  exitUnlessDevVaultConfig,
  resolveVaultConfigName,
} from './vault-dev';
import { resolveWorkspaceRoot } from './repo-root';
import {
  runStripeListenUntilExit,
  spawnStripeListen,
} from './stripe-listen-process';
import { createStripeListenTranscriptHandler } from './stripe-listen-transcript';
import { exitUnlessStripeCliWorks } from './stripe-cli-binary';
import { exitUnlessApiHealthy } from './wait-for-api-health';
import { stripeWebhookUrl } from './webhook-urls';
import { WriteQueue } from './write-queue';

async function main(): Promise<void> {
  const repoRoot = resolveWorkspaceRoot(import.meta.dir);
  process.chdir(repoRoot);

  const vaultConfig = resolveVaultConfigName();
  exitUnlessDevVaultConfig(vaultConfig);

  const secretStore = createVaultSecretStoreForScripts();
  const [stripeKeyRaw, apiUrlRaw] = await Promise.all([
    secretStore.getRequired(StripeSecretKeys.secretKey),
    secretStore.getRequired('API_URL'),
  ]);
  const stripeKey = stripeKeyRaw.readSecretValue().trim();
  const apiUrl = apiUrlRaw.readSecretValue().trim();
  exitUnlessLocalApiUrl(apiUrl);

  await exitUnlessStripeCliWorks(repoRoot);
  await exitUnlessApiHealthy(apiUrl, 60_000);

  const writeQueue = new WriteQueue();
  const onTranscriptLine = createStripeListenTranscriptHandler({
    writeQueue,
    secretStore,
    vaultConfig,
    apiUrl,
    stripeSecretKey: stripeKey,
  });

  const child = spawnStripeListen({
    repoRoot,
    stripeSecretKey: stripeKey,
    forwardToUrl: stripeWebhookUrl(apiUrl),
  });

  const exitCode = await runStripeListenUntilExit({
    child,
    onTranscriptLine,
    writeQueue,
  });

  if (exitCode !== 0) {
    process.exit(exitCode);
  }
}

await main().catch((e: unknown) => {
  console.error(
    `[${STRIPE_CLI_LOG_TAG}]`,
    e instanceof Error ? e.message : String(e)
  );
  process.exit(1);
});

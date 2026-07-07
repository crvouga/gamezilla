/**
 * Local Stripe webhook forwarder: `stripe listen` → API `/stripe/webhook`,
 * then writes the CLI signing secret to Infisical `dev` as STRIPE_WEBHOOK_SECRET.
 *
 * Run from monorepo root (`bun run dev` / turbo) so secrets env scope matches.
 */
import { resolveLocalPreviewApiOrigin } from '@libs/client-config/shared/resolve-local-preview-api-origin';
import { StripeSecretKeys } from '@libs/stripe/secret-keys';
import { createScriptSecretStore } from '@pkgs/secret-store';
import { exitUnlessLocalApiUrl } from './api-url-guard';
import { STRIPE_CLI_LOG_TAG } from './constants';
import { exitUnlessDevSecretsEnv, resolveSecretsEnvName } from './secrets-env';
import { resolveWorkspaceRoot } from './repo-root';
import {
  runStripeListenUntilExit,
  spawnStripeListen,
} from './stripe-listen-process';
import { createStripeListenTranscriptHandler } from './stripe-listen-transcript';
import { exitUnlessStripeCliWorks } from './stripe-cli-binary';
import { waitUntilApiHealthy } from './wait-for-api-health';
import { stripeWebhookUrl } from './webhook-urls';
import { WriteQueue } from './write-queue';

async function main(): Promise<void> {
  const repoRoot = resolveWorkspaceRoot(import.meta.dir);
  process.chdir(repoRoot);

  const secretsEnv = resolveSecretsEnvName();
  exitUnlessDevSecretsEnv(secretsEnv);

  const secretStore = createScriptSecretStore();
  const [stripeKeyRaw, apiUrl] = await Promise.all([
    secretStore.getRequired(StripeSecretKeys.secretKey),
    resolveLocalPreviewApiOrigin(),
  ]);
  const stripeKey = stripeKeyRaw.readSecretValue().trim();
  exitUnlessLocalApiUrl(apiUrl);

  await exitUnlessStripeCliWorks(repoRoot);
  await waitUntilApiHealthy(apiUrl);

  const writeQueue = new WriteQueue();
  const onTranscriptLine = createStripeListenTranscriptHandler({
    writeQueue,
    secretStore,
    secretsEnv,
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

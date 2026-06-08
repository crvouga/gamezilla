import type { SecretStore } from '@pkgs/secret-store';
import { StripeSecretKeys } from '@libs/stripe/secret-keys';
import { parseWhsecFromLine } from './listen-output-parser';
import { STRIPE_CLI_LOG_TAG } from './constants';
import { verifyWebhookWithSignedProbe } from './webhook-signed-probe';
import type { WriteQueue } from './write-queue';

export type StripeListenTranscriptDeps = {
  readonly writeQueue: WriteQueue;
  readonly secretStore: SecretStore;
  readonly vaultConfig: string;
  readonly apiUrl: string;
  readonly stripeSecretKey: string;
};

/**
 * Prefixes each `stripe listen` line and, on first `whsec_…`, writes Vault and
 * runs the signed webhook probe (serialized via {@link WriteQueue}).
 */
export function createStripeListenTranscriptHandler(
  deps: StripeListenTranscriptDeps
): (line: string) => void {
  let lastWritten: string | null = null;
  let webhookProbeDone = false;
  const { writeQueue, secretStore, vaultConfig, apiUrl, stripeSecretKey } =
    deps;

  return (line: string): void => {
    console.log(`[${STRIPE_CLI_LOG_TAG}] ${line}`);
    writeQueue.enqueue(async () => {
      const whsec = parseWhsecFromLine(line);
      if (whsec === null || whsec === lastWritten) return;
      await secretStore.setSecret(StripeSecretKeys.webhookSecret, whsec);
      lastWritten = whsec;
      console.log(
        `[${STRIPE_CLI_LOG_TAG}] wrote ${StripeSecretKeys.webhookSecret} to Vault (${vaultConfig})`
      );
      if (!webhookProbeDone) {
        webhookProbeDone = true;
        await verifyWebhookWithSignedProbe({
          apiBase: apiUrl,
          whsec,
          stripeSecretKey,
        });
      }
    });
  };
}

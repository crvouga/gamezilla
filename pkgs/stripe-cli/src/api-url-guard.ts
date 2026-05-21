import { isLocalApiUrl } from '@gamezilla/stripe/webhooks-sync-shared';
import { STRIPE_CLI_LOG_TAG } from './constants';

/** Refuse to forward Stripe traffic to a public origin by mistake. */
export function exitUnlessLocalApiUrl(url: string): void {
  if (isLocalApiUrl(url)) return;
  console.error(
    `[${STRIPE_CLI_LOG_TAG}] API_URL must be a local / private origin (loopback, localhost, RFC1918). Got: ${url}`
  );
  process.exit(1);
}

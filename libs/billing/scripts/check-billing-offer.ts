// @io-wall-ok
/**
 * Gate: the plus membership offer is sound. Pure — no provider, no
 * credentials, no writes.
 *
 * This used to *reconcile* the offer onto Stripe: the same call `billing:sync`
 * makes on deploy. So every pull request rewrote the live product catalogue,
 * prices, portal configuration and webhook endpoint, and needed production
 * billing credentials to do it — which is why the gate was green on a laptop
 * only because it silently skipped itself, and red in CI.
 *
 * Mutating the payment provider is a deploy action and stays in `billing:sync`
 * (`//#deploy`, after `provision` has seeded `API_URL`). What belongs in the
 * PR gate is whether the offer Stripe gets reconciled *from* is coherent, and
 * that is decidable from the value alone — so it reaches the same verdict on
 * every machine.
 */
import { PLUS_MEMBERSHIP_OFFER } from '@libs/billing/public/offer';
import { validatePlusMembershipOffer } from '../src/shared/offer/validate-offer';

const SCRIPT_TAG = 'billing check';

const problems = validatePlusMembershipOffer(PLUS_MEMBERSHIP_OFFER);
if (problems.length > 0) {
  console.error(
    `[${SCRIPT_TAG}] the plus membership offer is not sound:\n` +
      problems.map((problem) => `  - ${problem}`).join('\n')
  );
  process.exit(1);
}
console.log(
  `[${SCRIPT_TAG}] offer ok — ${String(Object.keys(PLUS_MEMBERSHIP_OFFER.prices).length)} prices, default '${PLUS_MEMBERSHIP_OFFER.defaultPriceKey}'`
);

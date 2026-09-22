import {
  type MembershipProviderEnv,
  membershipCallbackPath,
} from '@pkgs/billing';
import { BILLING_API_ORIGIN_SECRET } from '../secret-names';
import { PLUS_MEMBERSHIP_OFFER } from './plus-membership-offer';

/**
 * Absolute URL provider `provider` must POST subscription callbacks to, or
 * `null` when the deployed API origin is not resolvable.
 */
export async function readOfferCallbackUrl(
  readSecret: MembershipProviderEnv['readSecret'],
  provider: string
): Promise<string | null> {
  const raw = (await readSecret(BILLING_API_ORIGIN_SECRET))?.trim();
  if (typeof raw !== 'string' || raw.length === 0) return null;
  return `${raw.replace(/\/$/, '')}${membershipCallbackPath(PLUS_MEMBERSHIP_OFFER, provider)}`;
}

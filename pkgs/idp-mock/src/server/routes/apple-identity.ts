/**
 * The address and name an Apple-flavored provider discloses to one app.
 *
 * "Hide My Email" replaces the real address with a relay that is stable per
 * account per developer team, so two apps from one team see the same relay
 * and an app from another team sees a different one. The choice is made once,
 * on the first authorization, and every later id_token repeats it.
 */

import type { IdpConsentDetails } from '../../shared/screen-state';
import type { IdpAccount, IdpClient, IdpEmailChoice } from '../../shared/types';
import type { IdpStore } from '../idp-state';

export type DisclosedEmail = {
  readonly email: string;
  readonly isPrivate: boolean;
};

/** The team a relay address is scoped to; a bare client is its own team. */
export function teamOf(client: IdpClient | null, clientId: string): string {
  return client?.apple?.teamId ?? clientId;
}

export async function disclosedEmail(args: {
  readonly store: IdpStore;
  readonly account: IdpAccount;
  readonly client: IdpClient | null;
  readonly clientId: string;
  readonly choice: IdpEmailChoice | null;
}): Promise<DisclosedEmail> {
  if (args.choice !== 'hide') {
    return { email: args.account.email, isPrivate: false };
  }
  const relay = await args.store.relayAddress(
    args.account.sub,
    teamOf(args.client, args.clientId)
  );
  return { email: relay.email, isPrivate: true };
}

/**
 * Apple's `user` form field: `{"name":{"firstName","lastName"},"email"}`,
 * each part present only when its scope was requested. Sent once.
 */
export function appleUserBlob(args: {
  readonly scopes: readonly string[];
  readonly details: IdpConsentDetails;
  readonly email: DisclosedEmail;
}): string | null {
  const blob: Record<string, unknown> = {};
  if (args.scopes.includes('name')) {
    blob['name'] = {
      firstName: args.details.givenName,
      lastName: args.details.familyName,
    };
  }
  if (args.scopes.includes('email')) blob['email'] = args.email.email;
  return Object.keys(blob).length === 0 ? null : JSON.stringify(blob);
}

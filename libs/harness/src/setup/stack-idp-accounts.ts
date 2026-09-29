/**
 * A stack's simulated Google and Apple keep their own account directories.
 * The person behind each actor needs accounts there before they can sign in —
 * the in-process fabric adds them to its IdP nodes; a stack gets them through
 * each provider's test-only control plane (`/__admin/accounts`). Same people
 * as in-process: one Google account, and two Apple Accounts (the Gmail address
 * and an iCloud one).
 */
import { harnessIdpAccountId } from '../fabric/idp';

export type StackIdpOrigins = {
  readonly google: string;
  readonly apple: string;
};

async function addAccount(
  origin: string,
  handle: string,
  email: string
): Promise<void> {
  const givenName = handle.charAt(0).toUpperCase() + handle.slice(1);
  const response = await fetch(`${origin}/__admin/accounts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      id: harnessIdpAccountId(email),
      email,
      name: `${givenName} Tester`,
      givenName,
      familyName: 'Tester',
    }),
  });
  if (!response.ok) {
    throw new Error(
      `stack IdP ${origin}: adding ${email} failed (${String(response.status)}: ${await response.text()})`
    );
  }
}

export async function ensureStackIdpAccounts(args: {
  readonly idpOrigins: StackIdpOrigins;
  readonly actorId: string;
  /** The actor's Gmail address (run-tagged on a stack). */
  readonly email: string;
}): Promise<void> {
  const { idpOrigins, actorId, email } = args;
  const icloud = `${email.slice(0, email.indexOf('@'))}@icloud.com`;
  await addAccount(idpOrigins.google, actorId, email);
  await addAccount(idpOrigins.apple, actorId, email);
  await addAccount(idpOrigins.apple, actorId, icloud);
}

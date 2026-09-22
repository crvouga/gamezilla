/**
 * A user's profile is derived from their identities: the address is the
 * first *verified, non-relay* one (falling back to any address, so an
 * Apple-relay-only user still has one), and a name or photo, once known, is
 * kept — Apple only ever sends the name once.
 */

import type { IdentityRepository } from './identity-repository';
import type { IdpRepository } from './idp-repository';

export async function syncUserProfile(args: {
  readonly users: IdpRepository;
  readonly identities: IdentityRepository;
  readonly userId: string;
}): Promise<void> {
  const user = await args.users.findUserById(args.userId);
  if (user === null) return;
  const rows = await args.identities.listForUser(args.userId);
  const email =
    rows.find(
      (row) => row.email !== null && row.emailVerified && !row.isPrivateEmail
    )?.email ??
    rows.find((row) => row.email !== null)?.email ??
    null;
  const name = user.name ?? rows.find((row) => row.name !== null)?.name ?? null;
  const image =
    user.image ?? rows.find((row) => row.picture !== null)?.picture ?? null;
  if (email === user.email && name === user.name && image === user.image)
    return;
  await args.users.updateUserProfile({ id: user.id, email, name, image });
}

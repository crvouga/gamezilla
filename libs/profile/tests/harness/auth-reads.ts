import { signedInAccountOf } from '@libs/harness';

import type { openHarness } from './open-profile-harness';

type Harness = Awaited<ReturnType<typeof openHarness>>;

/** Wait until the device is signed in (by the server's verdict); its account. */
export async function signedInAs(s: Harness, actorId: string): Promise<string> {
  const account = await s.until((surf) => signedInAccountOf(surf, actorId), {
    maxMs: 20_000,
  });
  if (account === null) throw new Error(`${actorId} never signed in`);
  return account;
}

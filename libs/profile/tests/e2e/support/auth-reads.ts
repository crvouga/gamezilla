import { signedInAccountOf } from '@libs/sim-harness';

import type { openSim } from './open-profile-sim';

type Sim = Awaited<ReturnType<typeof openSim>>;

/** Wait until the device is signed in (by the server's verdict); its account. */
export async function signedInAs(s: Sim, actorId: string): Promise<string> {
  const account = await s.until((surf) => signedInAccountOf(surf, actorId), {
    maxMs: 20_000,
  });
  if (account === null) throw new Error(`${actorId} never signed in`);
  return account;
}

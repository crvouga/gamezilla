import { returnToTabs, signInWithGoogle } from '@libs/sim-harness';
import type { OpenSim } from '@libs/sim-harness/open-sim/open-sim';

/** Alice and bob, both signed in (usernames `alice` / `bob`), on their tabs. */
export async function signInPair(s: OpenSim): Promise<void> {
  for (const actor of ['alice', 'bob']) {
    await s.apply(signInWithGoogle, actor);
    await s.apply(returnToTabs, actor);
  }
}

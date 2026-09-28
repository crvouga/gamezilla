/** How long signing in takes to finish once the provider says yes. */

import { slowAccountReady } from '@libs/harness';
import { type Actor, Given } from '@libs/harness/spec/define';
import { otherDevice } from '@libs/harness/spec/steps/platform';

const SECOND_MS = 1_000;

Given(
  "signing in takes {int} seconds to finish on {actor}'s other device",
  async (w, seconds: number, actor: Actor) => {
    await w.s.apply(slowAccountReady, otherDevice(actor), seconds * SECOND_MS);
  }
);

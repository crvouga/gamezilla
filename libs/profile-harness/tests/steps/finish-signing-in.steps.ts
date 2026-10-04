/** How long signing in takes to finish once the provider says yes. */

import { slowAccountReady } from '@libs/harness/auth-actions';
import { Given } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';
import { otherDevice } from '@libs/harness/platform';

const SECOND_MS = 1_000;

Given(
  "signing in takes {int} seconds to finish on {actor}'s other device",
  async (w, seconds: number, actor: Actor) => {
    await w.s.apply(slowAccountReady, otherDevice(actor), seconds * SECOND_MS);
  }
);

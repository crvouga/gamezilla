/** How long signing in takes to finish once the provider says yes. */

import { slowAccountReady } from '@libs/harness-ts/auth-actions';
import { Given } from '@libs/harness-ts/define';
import type { Actor } from '@libs/harness-ts/parameter-types';
import { otherDevice } from '@libs/harness-ts/platform';

const SECOND_MS = 1_000;

Given(
  "signing in takes {int} seconds to finish on {actor}'s other device",
  async (w, seconds: number, actor: Actor) => {
    await w.s.apply(slowAccountReady, otherDevice(actor), seconds * SECOND_MS);
  }
);

/** Offline sign-in and local sign-out steps. */

import { abandonSignIn } from '@libs/sim-harness';
import { type Actor, When } from '@libs/sim-harness/spec/define';

When(
  '{actor} abandons Apple sign-in while offline',
  async (w, actor: Actor) => {
    await w.s.apply(abandonSignIn, actor, 'apple');
  }
);

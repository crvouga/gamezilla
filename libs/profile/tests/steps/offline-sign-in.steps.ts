/** Sign-in attempts that never finished. */

import { abandonSignIn } from '@libs/sim-harness';
import { type Actor, Given } from '@libs/sim-harness/spec/define';

Given(
  '{actor} has abandoned signing in with Apple',
  async (w, actor: Actor) => {
    await w.s.apply(abandonSignIn, actor, 'apple');
  }
);

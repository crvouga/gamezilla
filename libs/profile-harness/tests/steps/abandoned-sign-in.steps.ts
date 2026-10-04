/** Sign-in attempts that never finished. */

import { abandonSignIn } from '@libs/harness/auth-actions';
import { Given, When } from '@libs/harness/define';
import type { Actor } from '@libs/harness/parameter-types';

/** A `{provider}` parameter: the sign-in provider id. */
type Provider = 'google' | 'apple';

Given(
  '{actor} has abandoned signing in with {provider}',
  async (w, actor: Actor, provider: Provider) => {
    await w.s.apply(abandonSignIn, actor, provider);
  }
);

When(
  '{actor} abandons signing in with {provider}',
  async (w, actor: Actor, provider: Provider) => {
    await w.s.apply(abandonSignIn, actor, provider);
  }
);

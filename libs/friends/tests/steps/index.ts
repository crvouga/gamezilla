import '@libs/account-privacy/steps/privacy.steps';
/**
 * Steps entry for the `specs/<domain>/` features this package runs
 * (`specDomains`): registers the world (this package's harness
 * composition) and every step definition its features may use — the shared
 * platform steps, this package's own, and the profile and billing steps it
 * reuses (a Plus membership lifts the hosting limit).
 */

import '@libs/harness/spec/steps/platform';
import '@libs/profile/steps/profile.steps';
import '@libs/billing/steps/access.steps';
import './friends.steps';
import './account-privacy.steps';
import './search.steps';
import './spaces.steps';

import { useHarnessWorld } from '@libs/harness/spec/world';
import { openHarness } from '../harness/open-friends-harness';

useHarnessWorld(openHarness, (w) => ({
  beforeAccountDeletion: async (actor: Actor) => {
    await prepareNamedFriend(w.s, actor);
    await prepareNamedFriend(w.s, 'bob');
    await w.s.apply(prepareOldDevice, actor);
    if (await w.s.read(pendingRequestStored, actor, 'bob'))
      await w.s.apply(keepShownRequest, 'bob', actor);
  },
}));

import { prepareOldDevice } from '@libs/friends/harness/deleted-device';
import { keepShownRequest } from '@libs/friends/harness/privacy-actions';
import { pendingRequestStored } from '@libs/friends/harness/relationship-reads';
import { prepareNamedFriend } from '@libs/friends/harness/setup-friend-request';
import type { Actor } from '@libs/harness/spec/define';

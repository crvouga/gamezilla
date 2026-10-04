import '@libs/account-privacy-harness/privacy.steps';
/**
 * Steps entry for the `specs/<domain>/` features this package runs
 * (`specDomains`): registers the world (this package's harness
 * composition) and every step definition its features may use — the shared
 * platform steps, this package's own, and the profile and billing steps it
 * reuses (a Plus membership lifts the hosting limit).
 */

import '@libs/harness/platform';
import '@libs/profile-harness/profile.steps';
import '@libs/billing-harness/access.steps';

import { useHarnessWorld } from '@libs/harness/spec-world';
import { openHarness } from '../open-friends-harness';

// Every `*.steps.ts` under this folder registers itself; a new one
// needs no edit here.
const modules = new Bun.Glob('**/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...modules].sort()) await import(`./${file}`);

// Exported steps belong to this package and register alongside its private steps.
const exported = new Bun.Glob('../../src/*.steps.ts').scanSync(import.meta.dir);
for (const file of [...exported].sort()) await import(`./${file}`);

useHarnessWorld(openHarness, (w) => ({
  beforeAccountDeletion: async (actor: Actor) => {
    await prepareNamedFriend(w.s, actor);
    await prepareNamedFriend(w.s, 'bob');
    await w.s.apply(prepareOldDevice, actor);
    if (await w.s.read(pendingRequestStored, actor, 'bob'))
      await w.s.apply(keepShownRequest, 'bob', actor);
  },
}));

import { prepareOldDevice } from '@libs/friends-harness/deleted-device';
import { keepShownRequest } from '@libs/friends-harness/privacy-actions';
import { pendingRequestStored } from '@libs/friends-harness/relationship-reads';
import { prepareNamedFriend } from '@libs/friends-harness/setup-friend-request';
import type { Actor } from '@libs/harness/parameter-types';

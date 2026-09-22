/**
 * Shell-level scenario actions: tab bar, global menu → Settings.
 * These drive only ported chrome (no screen bodies), so they stay green while
 * feature screens are still `RouteStub`s.
 */

import { Handles } from '@libs/test-ids';

import { actorUi, scenarioAction } from './actor-ui';

const WAIT_MS = 15_000;

/**
 * Global menu → Settings (`/more`). Settings is a stack route outside the
 * tab layout, so the tab bar leaving proves the navigation.
 */
export const openSettings = scenarioAction({
  name: 'openSettings',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.statusCurrentUser).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.globalMenuSettings).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.tabSpaces).expect.hidden({ timeoutMs: WAIT_MS });
  },
});

/** Global menu → Account: where sign-in and sign-out live. */
export const openAccount = scenarioAction({
  name: 'openAccount',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.statusCurrentUser).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.globalMenuAccount).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.tabSpaces).expect.hidden({ timeoutMs: WAIT_MS });
  },
});

/** Focus an actor's tree (multi-actor hosts park the others). */
export const focusActor = scenarioAction({
  name: 'focusActor',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.statusCurrentUser).expect.visible({
      timeoutMs: WAIT_MS,
    });
  },
});

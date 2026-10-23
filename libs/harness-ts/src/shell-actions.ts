/**
 * Shell-level scenario actions: tab bar, global menu → Settings.
 * These drive only ported chrome (no screen bodies), so they stay green while
 * sub screens are still `RouteStub`s.
 */

import { Handles } from '@libs/test-ids-shared-ts/handles';

import { actorUi, scenarioAction } from './actor-ui';
import { openGlobalMenu } from './driver-gestures';

const WAIT_MS = 15_000;

/**
 * Global menu → Settings (`/more`). Settings is a stack route outside the
 * tab layout, so the tab bar leaving proves the navigation.
 */
export const openSettings = scenarioAction({
  name: 'openSettings',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await openGlobalMenu(ui, Handles.globalMenuSettings, WAIT_MS);
    await ui.get(Handles.globalMenuSettings).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.settingsTheme).expect.visible({ timeoutMs: WAIT_MS });
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

/**
 * Back to the tab bar from wherever the actor is: pops stack screens until
 * the Profile tab is addressable. A no-op when already there, unlike
 * `returnToTabs`, which asserts one pop.
 */
export const backToTabs = scenarioAction({
  name: 'backToTabs',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui
      .get(Handles.statusCurrentUser)
      .expect.visible({ timeoutMs: WAIT_MS });
    for (let pops = 0; pops < 4; pops++) {
      if (await ui.get(Handles.tabProfile).isVisible()) break;
      const back = (await ui.get(Handles.navBack).isVisible())
        ? Handles.navBack
        : Handles.spaceClose;
      if (!(await ui.get(back).isVisible())) break;
      await ui.get(back).tap({ timeoutMs: WAIT_MS });
      await s.session.waitForIdle();
    }
    await ui.get(Handles.tabProfile).expect.visible({ timeoutMs: WAIT_MS });
  },
});

/**
 * Tap a tab (`Handles.tab*`) from wherever the tab bar is reachable: back to
 * the tab bar first when a stack screen (Settings, an ended space) hides it.
 */
export const openTab = scenarioAction({
  name: 'openTab',
  act: async (s, actorId: string, tabTestId: string) => {
    const ui = await actorUi(s, actorId);
    await Promise.resolve(backToTabs.act(s, actorId));
    await ui.get(tabTestId).tap({ timeoutMs: WAIT_MS });
    await s.session.waitForIdle();
  },
});

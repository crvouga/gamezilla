import { Handles } from '@libs/test-ids';

import { actorUi, scenarioAction } from './actor-ui';

const WAIT_MS = 15_000;

/**
 * Open the avatar menu → Account, tap Dev on the sign-in modal, then dismiss
 * the signed-in success.
 */
export const signInWithDev = scenarioAction({
  name: 'signInWithDev',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.statusCurrentUser).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.globalMenuAccount).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.accountSignIn).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.authMethodDev).tap({ timeoutMs: WAIT_MS });
    await ui.get(Handles.authSignedInDone).tap({ timeoutMs: WAIT_MS });
    if (await ui.get(Handles.authModalClose).isVisible()) {
      await ui.get(Handles.authModalClose).tap({ timeoutMs: 1000 });
    }
  },
});

/** Confirm sign-out from the account screen. */
export const signOut = scenarioAction({
  name: 'signOut',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.accountSignOut).tap();
    await ui.get(Handles.authSignOutConfirm).tap();
    await ui.get(Handles.authSignedOut).expect.visible({ timeoutMs: WAIT_MS });
  },
});

/** Leave the Account stack so the tab shell is visible again. */
export const returnToTabs = scenarioAction({
  name: 'returnToTabs',
  act: async (s, actorId: string) => {
    const ui = await actorUi(s, actorId);
    await ui.get(Handles.navBack).tap();
    await ui.get(Handles.tabProfile).expect.visible();
  },
});

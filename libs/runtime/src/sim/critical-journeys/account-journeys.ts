/** Journeys of a signed-in person: their session, their profile, people search. */

import { openGlobalMenu } from '@libs/sim-harness/system/driver-gestures';
import { Handles } from '@libs/test-ids';
import {
  atTabShell,
  expectVisible,
  JOURNEY_WAIT_MS,
  openTab,
  tap,
} from './journey-steps';
import type { CriticalJourney } from './journey-types';

/** The session the runner established is live, and signing out ends it. */
export const signInAndOut: CriticalJourney = {
  id: 'sign-in-and-out',
  title: 'A signed-in person sees their account and can sign out',
  access: 'signed-in',
  requiresBrowser: false,
  run: async ({ ui }) => {
    await atTabShell(ui);
    await openGlobalMenu(ui, Handles.globalMenuAccount, JOURNEY_WAIT_MS);
    await tap(ui, Handles.globalMenuAccount);
    await tap(ui, Handles.accountSignOut);
    await tap(ui, Handles.authSignOutConfirm);
    await expectVisible(ui, Handles.accountSignIn);
  },
};

/** A profile write round-trips: save the avatar, reopen, see it kept. */
export const profileAvatarSaves: CriticalJourney = {
  id: 'profile-avatar-saves',
  title: 'A person changes their avatar and the change is kept',
  access: 'signed-in',
  requiresBrowser: false,
  run: async ({ ui, runId }) => {
    const seed = `synthetic-${runId}`;
    await openTab(ui, Handles.tabProfile);
    await tap(ui, Handles.profileEdit);
    await tap(ui, Handles.profileEditAvatar);
    const seedField = ui.get(Handles.profileAvatarSeed);
    await seedField.expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
    await seedField.clear();
    await seedField.input(seed);
    await tap(ui, Handles.profileAvatarSave);
    await ui
      .get(Handles.profileAvatarSave)
      .expect.text('Saved', { timeoutMs: JOURNEY_WAIT_MS });
    await tap(ui, Handles.profileAvatarCancel);
    await tap(ui, Handles.profileEditAvatar);
    await seedField.expect.text(seed, {
      exact: true,
      timeoutMs: JOURNEY_WAIT_MS,
    });
  },
};

/** People search answers: a query that matches nobody settles on "no results". */
export const peopleSearchAnswers: CriticalJourney = {
  id: 'people-search-answers',
  title: 'People search answers a query instead of spinning forever',
  access: 'signed-in',
  requiresBrowser: false,
  run: async ({ ui, runId }) => {
    await openTab(ui, Handles.tabSearch);
    const input = ui.get(Handles.searchInput);
    await input.expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
    await input.clear();
    await input.input(`zz-nobody-${runId}`);
    await expectVisible(ui, Handles.searchEmpty);
    await ui
      .get(Handles.searchLoading)
      .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
  },
};

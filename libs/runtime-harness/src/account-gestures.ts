/** What a signed-in person does: sign out, save their avatar, search people. */

import { openGlobalMenu } from '@libs/harness/driver-gestures';
import { Handles } from '@libs/test-ids-shared/handles';
import type { Driver } from '@pkgs/ui-testing-root-shared/driver';
import {
  atTabShell,
  expectVisible,
  JOURNEY_WAIT_MS,
  openTab,
  tap,
} from './journey-gestures';

export async function signOut(ui: Driver): Promise<void> {
  await atTabShell(ui);
  await openGlobalMenu(ui, Handles.globalMenuAccount, JOURNEY_WAIT_MS);
  await tap(ui, Handles.globalMenuAccount);
  await tap(ui, Handles.accountSignOut);
  await tap(ui, Handles.authSignOutConfirm);
  await expectVisible(ui, Handles.accountSignIn);
  if (await ui.get(Handles.authSignOutModal).isVisible())
    await tap(ui, Handles.authSignOutDone);
  await ui.get(Handles.authSignOutModal).wait('hidden', {
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

export async function expectSignInOffered(ui: Driver): Promise<void> {
  await expectVisible(ui, Handles.accountSignIn);
}

/** Save `seed` as the avatar seed and leave the editor. */
export function saveAvatar(seed: string): (ui: Driver) => Promise<void> {
  return async (ui) => {
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
  };
}

/** Reopen the avatar editor and see `seed` kept. */
export function expectAvatarSeed(seed: string): (ui: Driver) => Promise<void> {
  return async (ui) => {
    await tap(ui, Handles.profileEditAvatar);
    await ui.get(Handles.profileAvatarSeed).expect.text(seed, {
      exact: true,
      timeoutMs: JOURNEY_WAIT_MS,
    });
  };
}

export function searchPeople(query: string): (ui: Driver) => Promise<void> {
  return async (ui) => {
    await openTab(ui, Handles.tabSearch);
    const input = ui.get(Handles.searchInput);
    await input.expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
    await input.clear();
    await input.input(query);
  };
}

/** The search settled on "no results" instead of spinning. */
export async function expectNoSearchResults(ui: Driver): Promise<void> {
  await expectVisible(ui, Handles.searchEmpty);
  await ui
    .get(Handles.searchLoading)
    .expect.hidden({ timeoutMs: JOURNEY_WAIT_MS });
}

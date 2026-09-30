/**
 * Gestures the critical journeys share. Everything here is a bare
 * {@link Driver} gesture — no harness, no session — so the same step runs on
 * pumped virtual time in `bun check` and on a real browser against production.
 */

import {
  openGlobalMenu,
  pressBackUntilVisible,
} from '@libs/harness/system/driver-gestures';
import { Handles } from '@libs/test-ids';
import type { Driver } from '@pkgs/ui-testing';

/**
 * Wall-time budget for one step against production (network round trips,
 * cold Worker). Virtual time in the harness makes it free there.
 */
export const JOURNEY_WAIT_MS = 20_000;
/** A modal's submit hides once the mutation settles. */
const MUTATION_SETTLE_MS = 10_000;

/** Journey assertion: plain `Error`, never disabled by an assert switch. */
export function check(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

export async function atTabShell(ui: Driver): Promise<void> {
  await ui.get(Handles.statusCurrentUser).expect.visible({
    timeoutMs: JOURNEY_WAIT_MS,
  });
}

export async function tap(ui: Driver, testId: string): Promise<void> {
  await ui.get(testId).tap({ timeoutMs: JOURNEY_WAIT_MS });
}

export async function expectVisible(ui: Driver, testId: string): Promise<void> {
  await ui.get(testId).expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
}

/**
 * The runner's sign-in took: the account screen offers "Sign out" (not
 * "Sign in"). Ends back on the tab shell, where every journey starts.
 */
export async function confirmSignedIn(ui: Driver): Promise<void> {
  await atTabShell(ui);
  await openGlobalMenu(ui, Handles.globalMenuAccount, JOURNEY_WAIT_MS);
  await tap(ui, Handles.globalMenuAccount);
  await expectVisible(ui, Handles.accountSignOut);
  await pressBackUntilVisible(ui, Handles.tabProfile, JOURNEY_WAIT_MS);
}

/** Open a bottom tab, backing out of a pushed screen first if needed. */
export async function openTab(ui: Driver, tab: string): Promise<void> {
  await atTabShell(ui);
  if (!(await ui.get(tab).isVisible())) {
    await pressBackUntilVisible(ui, tab, JOURNEY_WAIT_MS);
  }
  await tap(ui, tab);
}

const ENTER_POLLS = 3;
const ENTER_SETTLE_MS = 5_000;

async function endIsUp(ui: Driver): Promise<boolean> {
  try {
    await ui
      .get(Handles.spaceEnd)
      .expect.visible({ timeoutMs: JOURNEY_WAIT_MS });
    return true;
  } catch {
    return false;
  }
}

/**
 * Be inside the space. A fresh device has no open session, so a hosted
 * space opens on Join; End exists only after that join has finished.
 * Tapping Join and returning immediately misses End while the join is
 * still running, and one tap is not enough when the first one does not
 * take. The last poll still taps: giving up while Join is on screen
 * leaves the space live.
 */
async function enterHostedSpace(ui: Driver): Promise<void> {
  const end = ui.get(Handles.spaceEnd);
  const join = ui.get(Handles.spaceJoin);
  for (let attempt = 0; attempt < ENTER_POLLS; attempt += 1) {
    if (await end.isVisible()) return;
    if (!(await join.isVisible())) {
      try {
        await join.expect.visible({ timeoutMs: ENTER_SETTLE_MS });
      } catch {
        continue;
      }
    }
    await tap(ui, Handles.spaceJoin);
    if (await endIsUp(ui)) return;
  }
  check(false, 'the hosted space never opened, so it cannot be ended');
}

/** End the space the person is in and see it ended. */
export async function endActiveSpace(ui: Driver): Promise<void> {
  await enterHostedSpace(ui);
  await tap(ui, Handles.spaceEnd);
  await tap(ui, Handles.spaceEndConfirm);
  await ui
    .get(Handles.spaceEndConfirm)
    .expect.hidden({ timeoutMs: MUTATION_SETTLE_MS });
  await tap(ui, Handles.spaceMutationDismiss);
  await ui
    .get(Handles.spaceMutationDismiss)
    .expect.hidden({ timeoutMs: MUTATION_SETTLE_MS });
  await expectVisible(ui, Handles.spaceEnded);
}

/**
 * A free account hosts one live space, and the production monitor account is
 * that same account on every run. A run that died after creating a space left
 * it live, and the next create is the Plus invitation. End those leftovers
 * first. The hosting count is hidden both while the list is still syncing
 * and when the person hosts none, so wait until the list has answered.
 */
const LEFTOVER_HOST_LIMIT = 20;

async function showSpaces(ui: Driver): Promise<void> {
  await atTabShell(ui);
  if (!(await ui.get(Handles.spaceCreate).isVisible())) {
    if (await ui.get(Handles.tabSpaces).isVisible()) {
      await tap(ui, Handles.tabSpaces);
    } else {
      await pressBackUntilVisible(ui, Handles.spaceCreate, JOURNEY_WAIT_MS);
    }
  }
  await expectVisible(ui, Handles.spacesListReady);
}

async function hostUsername(ui: Driver): Promise<string> {
  await openTab(ui, Handles.tabProfile);
  const raw = (await ui.get(Handles.profileDisplayUsername).text()) ?? '';
  const username = raw.trim().replace(/^@/, '');
  check(
    username.length > 0,
    'the profile has no username to find hosted spaces'
  );
  return username;
}

async function releaseLeftoverHostedSpaces(ui: Driver): Promise<void> {
  await showSpaces(ui);
  if (!(await ui.get(Handles.spacesHostingCount).isVisible())) return;
  const card = Handles.spaceCard(await hostUsername(ui));
  for (let released = 0; released < LEFTOVER_HOST_LIMIT; released += 1) {
    await showSpaces(ui);
    if (!(await ui.get(card).isVisible())) return;
    await tap(ui, card);
    await endActiveSpace(ui);
  }
  await showSpaces(ui);
  check(
    !(await ui.get(card).isVisible()),
    'hosted spaces are still open after ending the leftovers'
  );
}

/** Host a space from the Spaces tab; ends inside it. */
export async function hostSpace(ui: Driver): Promise<void> {
  await releaseLeftoverHostedSpaces(ui);
  await openTab(ui, Handles.tabSpaces);
  await tap(ui, Handles.spaceCreate);
  await expectVisible(ui, Handles.spaceClose);
}

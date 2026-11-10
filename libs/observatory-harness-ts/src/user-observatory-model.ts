/**
 * The User Observatory as the model sees it: Alice follows the online-now
 * list on her phone and watches live on her tablet; Bob is a person and
 * Cedar a Synthetic User. Everything here is read from what each of them
 * sees on their own device.
 */

import { partition, restoreActorConnection } from '@libs/harness-ts/actions';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import { signInWithGoogleAsAccount } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { connectionMissing } from '@libs/harness-ts/network-notices';
import { bringToFront, partitioned } from '@libs/harness-ts/observations';
import { grantOperatorPermissions } from '@libs/observatory-actions-harness-ts/operator-access-actions';
import {
  closePersonApp,
  emailOf,
  onlineNowRow,
  openPersonApp,
  openUserObservatory,
  watchEndedShown,
  watchedPlace,
  watchedScreen,
} from '@libs/observatory-actions-harness-ts/user-observatory-actions';
import {
  LIVE_HEARTBEAT_MS,
  LIVE_ONLINE_WINDOW_MS,
  placeOfRoute,
} from '@libs/observatory-shared-ts/live-session';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import {
  givenSyntheticGameChoice,
  startSyntheticActivity,
} from '@libs/synthetic-population-harness-ts/game-choice-actions';

/** Alice's devices: her phone follows the list, her tablet watches live. */
export const ALICE_LIST = 'alice';
export const ALICE_WATCH = 'alice:tablet';
const SETTLE_OFFLINE_MS = LIVE_ONLINE_WINDOW_MS + 5_000;
/** Long enough for a reconnected app's next heartbeat and a list reread. */
const SETTLE_RETURN_MS = LIVE_HEARTBEAT_MS + 5_000;

/** The model's names for places in the app, by what the app calls them. */
const MODEL_PLACES: Record<string, string> = {
  spaces: 'tabs',
  profile: 'tabs',
  notifications: 'tabs',
  space: 'game',
  settings: 'Settings',
  'people-search': 'people search',
  'sign-in-methods': 'sign-in methods',
};
const SHOWN_PLACES: Record<string, string> = {
  Spaces: 'tabs',
  Profile: 'tabs',
  Notifications: 'tabs',
  'In a space': 'game',
  Settings: 'Settings',
  'People search': 'people search',
  'Sign-in methods': 'sign-in methods',
};

/** The model's people and Synthetic Users, by their device. */
export function deviceOf(who: string): string {
  return who.toLowerCase();
}

/** Alice may view and watch; her phone shows the list, her tablet is ready. */
export const givenUserObservatory = scenarioAction({
  name: 'givenUserObservatory',
  act: async (s, game: string) => {
    await Promise.resolve(givenSyntheticGameChoice.act(s, 'Cedar'));
    await Promise.resolve(startSyntheticActivity.act(s, game));
    await Promise.resolve(openPersonApp.act(s, 'bob'));
    await Promise.resolve(openPersonApp.act(s, ALICE_LIST));
    await Promise.resolve(
      grantOperatorPermissions.act(s, ALICE_LIST, [
        PERMISSION.observatoryView,
        PERMISSION.observatoryWatch,
      ])
    );
    await Promise.resolve(
      signInWithGoogleAsAccount.act(s, ALICE_WATCH, ALICE_LIST)
    );
    await Promise.resolve(openUserObservatory.act(s, ALICE_LIST));
  },
});

/** The model's someone opens the app again on their device. */
export const reopenLiveApp = scenarioAction({
  name: 'reopenLiveApp',
  act: async (s, who: string) => {
    await Promise.resolve(openPersonApp.act(s, deviceOf(who)));
  },
});

/** Bob's or Cedar's device loses its connection and stays without it a while. */
export const loseLiveConnection = scenarioAction({
  name: 'loseLiveConnection',
  act: async (s, who: string) => {
    const device = deviceOf(who);
    if (s.actors.has(device)) await Promise.resolve(partition.act(s, device));
    // Long enough for an app that stopped reporting to drop off the list.
    await s.session.advanceTime(SETTLE_OFFLINE_MS);
    await s.session.waitForIdle();
  },
});

/** That device's connection comes back; an open app reports again. */
export const restoreLiveConnection = scenarioAction({
  name: 'restoreLiveConnection',
  act: async (s, who: string) => {
    const device = deviceOf(who);
    if (s.actors.has(device))
      await Promise.resolve(restoreActorConnection.act(s, device));
    await s.session.advanceTime(SETTLE_RETURN_MS);
    await s.session.waitForIdle();
  },
});

/** Alice's devices lose, or regain, their connection. */
export const setAliceLiveConnection = scenarioAction({
  name: 'setAliceLiveConnection',
  act: async (s, online: boolean) => {
    for (const device of [ALICE_LIST, ALICE_WATCH])
      await Promise.resolve(
        online
          ? restoreActorConnection.act(s, device)
          : partition.act(s, device)
      );
    await s.session.waitForIdle();
  },
});

/** Closes the app of someone in the model. */
export const closeLiveApp = scenarioAction({
  name: 'closeLiveApp',
  act: async (s, who: string) => {
    await Promise.resolve(closePersonApp.act(s, deviceOf(who)));
  },
});

/** Cedar carries on with its game: back to looking for an opponent if not. */
export const continueSyntheticActivity = scenarioAction({
  name: 'continueSyntheticActivity',
  act: async (s, game: string) => {
    const path = await s.actors.get('cedar')!.currentPath();
    if (placeOfRoute(path) !== 'space')
      await Promise.resolve(startSyntheticActivity.act(s, game));
  },
});

function connected(s: ProductHarness, device: string): boolean {
  return (
    s.actors.has(device) &&
    !partitioned(s).some((pair) => pair.split('|').includes(device))
  );
}

/** Where the device's own screen is, in the model's words. */
async function placeOnDevice(
  s: ProductHarness,
  device: string
): Promise<string | null> {
  if (!s.actors.has(device)) return null;
  const route = placeOfRoute(await s.actors.get(device)!.currentPath());
  return MODEL_PLACES[route] ?? route;
}

/** Who Alice's tablet is watching live, and the place it shows. */
async function watchedOnTablet(s: ProductHarness) {
  if (!s.actors.has(ALICE_WATCH)) return { watching: '', placeShown: '' };
  const place = await watchedPlace(s, ALICE_WATCH);
  if (place === null) return { watching: '', placeShown: '' };
  const title = await (await actorUi(s, ALICE_WATCH))
    .get('live-watch-kind')
    .text();
  const shown =
    Object.entries(SHOWN_PLACES).find(([label]) =>
      place.includes(label)
    )?.[1] ?? place;
  return {
    watching: title?.includes('Synthetic User') ? 'Cedar' : 'Bob',
    placeShown: shown,
  };
}

/**
 * What each of them sees now, in the model's terms: who is online now (an
 * open, connected app), Alice's list and filter, where each open app is,
 * what Alice's tablet is watching and shows, and whether the watch has
 * ended. `searched` is what Bob searched for, never to be shown.
 */
export async function observeUserObservatory(
  s: ProductHarness,
  searched: string
) {
  const people = ['Bob', 'Cedar'];
  const listShown: string[] = [];
  const places: Record<string, string> = {};
  for (const who of people) {
    if ((await onlineNowRow(s, ALICE_LIST, who)) !== null) listShown.push(who);
    const place = await placeOnDevice(s, deviceOf(who));
    if (place !== null) places[who] = place;
  }
  const showing = await shownKinds(s);
  const watch = await watchedOnTablet(s);
  const tablet = s.actors.has(ALICE_WATCH);
  const screen = tablet ? await watchedScreen(s, ALICE_WATCH) : null;
  const ended = tablet && (await watchEndedShown(s, ALICE_WATCH));
  const email = await emailOf(s, 'bob');
  const leaked =
    screen !== null &&
    (screen.includes(email) ||
      (searched.length > 0 && screen.toLowerCase().includes(searched)));
  await bringToFront(s, ALICE_LIST);
  return {
    onlineNow: people.filter((who) => connected(s, deviceOf(who))),
    listShown,
    showing,
    places,
    watching: watch.watching,
    placeShown: watch.placeShown,
    privateDetailsShown: leaked,
    ended,
    connectionAvailable: !(await connectionMissing(s, ALICE_LIST)),
  };
}

/** Which kinds Alice's list shows: people, Synthetic Users, or both. */
async function shownKinds(s: ProductHarness): Promise<string[]> {
  await bringToFront(s, ALICE_LIST);
  const ui = await actorUi(s, ALICE_LIST);
  const chosen = async (key: string) =>
    (await ui.get(`online-now-filter-${key}`).attribute('aria-checked')) ===
    'true';
  if (await chosen('people')) return ['people'];
  if (await chosen('synthetic')) return ['Synthetic Users'];
  return ['people', 'Synthetic Users'];
}

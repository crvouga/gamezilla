/**
 * The User Observatory as a person uses it: opening it, whoever is online
 * now, and watching one of them live. The selectors and gestures of the
 * online-now list and the watch screen live here; steps only name people and
 * what they see.
 */

import {
  actorUi,
  ensureActor,
  pollUntil,
  scenarioAction,
} from '@libs/harness-ts/actor-ui';
import { signInWithGoogle } from '@libs/harness-ts/auth-actions';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { actorEmail, signedInAccountOf } from '@libs/harness-ts/identity';
import { bringToFront } from '@libs/harness-ts/observations';
import { backToTabs } from '@libs/harness-ts/shell-actions';
import type { OnlineNowFilter } from '@libs/observatory-shared-ts/live-session';
import {
  liveWatchPath,
  OBSERVATORY_PATH,
} from '@libs/observatory-shared-ts/observatory-routes';
import sql from '@pkgs/sql-root-shared-ts/sql';

const ONLINE_MS = 15_000;

/** The username a scenario's name has in the app. */
function usernameOf(name: string): string {
  return name.toLowerCase();
}

/** Whether the server holds a fresh heartbeat from the actor's open app. */
async function heartbeatReceived(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const accountId = await signedInAccountOf(s, actor);
  if (accountId === null) return false;
  const rows = await s.harness.serverSql.sqlClient.query(sql<{ id: string }>`
    SELECT id FROM population_live_sessions
    WHERE account_id = ${accountId} AND deleted_at IS NULL`);
  return rows.length > 0;
}

/** The person opens the User Observatory. */
export const openUserObservatory = scenarioAction({
  name: 'openUserObservatory',
  act: async (s, actor: string) => {
    await actorUi(s, actor);
    await s.actors.get(actor)!.openLink(OBSERVATORY_PATH);
  },
});

/** Whether the person is told they may not view the User Observatory or watch live. */
export async function observatoryDenied(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  return (
    (await ui.get('observatory-denied').isVisible()) ||
    (await ui.get('observatory-watch-denied').isVisible())
  );
}

/** The person opens the app, signed in, and it tells the server so. */
export const openPersonApp = scenarioAction({
  name: 'openPersonApp',
  act: async (s, actor: string) => {
    await ensureActor(s, actor);
    // Reopened, an app is still signed in as it was.
    if ((await signedInAccountOf(s, actor)) === null)
      await Promise.resolve(signInWithGoogle.act(s, actor));
    await Promise.resolve(backToTabs.act(s, actor));
    await pollUntil(
      s,
      async () => ((await heartbeatReceived(s, actor)) ? true : null),
      { maxMs: ONLINE_MS, description: `${actor}'s app is online now` }
    );
  },
});

/**
 * The person closes the app on this device. Its storage stays; nothing on
 * it runs until it is opened again.
 */
export const closePersonApp = scenarioAction({
  name: 'closePersonApp',
  act: async (s, actor: string) => {
    await s.runtime.restartActor(actor);
    await s.session.waitForIdle();
    const remaining = s.actors.keys().next().value;
    if (remaining !== undefined) await bringToFront(s, remaining);
  },
});

/** The observer shows everyone, only people, or only Synthetic Users. */
export const showOnlyOnlineNow = scenarioAction({
  name: 'showOnlyOnlineNow',
  act: async (s, observer: string, filter: OnlineNowFilter) => {
    const ui = await actorUi(s, observer);
    await bringToFront(s, observer);
    await ui.get(`online-now-filter-${filter}`).tap();
    await s.session.waitForIdle();
  },
});

/** What the observer's online-now row for `name` says, if it is shown. */
export async function onlineNowRow(
  s: ProductHarness,
  observer: string,
  name: string
): Promise<string | null> {
  await bringToFront(s, observer);
  const row = (await actorUi(s, observer)).get(
    `online-now-row-${usernameOf(name)}`
  );
  return (await row.isVisible()) ? ((await row.text()) ?? '') : null;
}

/** Whether the observer's row for `name` offers its control panel. */
export async function controlPanelOffered(
  s: ProductHarness,
  observer: string,
  name: string
): Promise<boolean> {
  await bringToFront(s, observer);
  return (await actorUi(s, observer))
    .get(`online-now-control-panel-${usernameOf(name)}`)
    .isVisible();
}

/** The live session of the actor's open app, as a link to it would name it. */
async function liveSessionOf(
  s: ProductHarness,
  actor: string
): Promise<string | null> {
  const accountId = await signedInAccountOf(s, usernameOf(actor));
  const rows = await s.harness.serverSql.sqlClient.query(sql<{ id: string }>`
    SELECT id FROM population_live_sessions
    WHERE account_id = ${accountId ?? ''} AND deleted_at IS NULL`);
  return rows[0]?.id ?? null;
}

/**
 * The watcher watches someone live: from the online-now list where it lets
 * them, and otherwise by the watch link itself, as a person who was sent it.
 */
export const watchLive = scenarioAction({
  name: 'watchLive',
  act: async (s, watcher: string, target: string) => {
    await Promise.resolve(openUserObservatory.act(s, watcher));
    const ui = await actorUi(s, watcher);
    const row = ui.get(`online-now-row-${usernameOf(target)}`);
    await row.wait('visible', { timeoutMs: ONLINE_MS }).catch(() => undefined);
    if (await row.isVisible()) await row.tap();
    await s.session.waitForIdle();
    if (await ui.get('live-watch-place').isVisible()) return;
    const session = await liveSessionOf(s, target);
    if (session === null) throw new Error(`${target} is not online now`);
    await s.actors.get(watcher)!.openLink(liveWatchPath(session));
    await s.session.waitForIdle();
  },
});

/** The place in the app the watcher sees, or `null` without a watch. */
export async function watchedPlace(
  s: ProductHarness,
  watcher: string
): Promise<string | null> {
  await bringToFront(s, watcher);
  const place = (await actorUi(s, watcher)).get('live-watch-place');
  return (await place.isVisible()) ? ((await place.text()) ?? '') : null;
}

/** The watched screen's markup as the watcher's mirror draws it, if any. */
export async function watchedScreen(
  s: ProductHarness,
  watcher: string
): Promise<string | null> {
  await bringToFront(s, watcher);
  const mirror = (await actorUi(s, watcher)).get('live-watch-screen');
  return (await mirror.isVisible()) ? mirror.attribute('srcdoc') : null;
}

/** Whether the watcher is told the one watched is no longer online now. */
export async function watchEndedShown(
  s: ProductHarness,
  watcher: string
): Promise<boolean> {
  await bringToFront(s, watcher);
  return (await actorUi(s, watcher)).get('live-watch-ended').isVisible();
}

/** The person's own email address, as the app would show it to them. */
export async function emailOf(
  s: ProductHarness,
  actor: string
): Promise<string> {
  return actorEmail(s, actor);
}

/**
 * The Synthetic Users' control panels and the controls for every Synthetic
 * User at once, driven through the Bot Observatory as a person does; where a
 * deployed Synthetic Population Worker would act on a command, the fixture
 * worker acts the same way.
 */

import { GAME_AUTOMATIONS } from '@libs/game-catalog-shared-ts/game-automations';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import { SyntheticPopulationAdministration } from '@libs/synthetic-population-server-ts/synthetic-population-administration';
import { SyntheticPopulationSession } from '@libs/synthetic-population-server-ts/synthetic-population-session';
import { SyntheticUserApplication } from '@libs/synthetic-population-shared-ts/synthetic-user-application';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { reopenSyntheticApp } from './continuity-actions';
import { syntheticGameView } from './synthetic-game-actions';
import { syntheticUserActor } from './synthetic-sign-in-actions';
import {
  givenSyntheticUser,
  syntheticPopulationPorts,
  syntheticUserNamed,
} from './synthetic-user-fixtures';

const WAIT_MS = 15_000;

async function leasedSession(s: ProductHarness, name: string) {
  const user = await syntheticUserNamed(s, name);
  if (user.worker_id === null) throw new Error(`${name} has no Worker Lease`);
  const lease = {
    userId: user.id,
    workerId: user.worker_id,
    generation: user.generation,
  };
  const sessions = new SyntheticPopulationSession(
    s.harness.serverSql.sqlClient,
    syntheticPopulationPorts(s)
  );
  const renewal = await sessions.renew(lease);
  if (renewal === null) throw new Error(`${name} has lost its Worker Lease`);
  return { lease, sessions, renewal };
}

/**
 * What the named Synthetic User's worker does on its next tick once told
 * whether it is paused: a paused one starts nothing new and signs out.
 */
export const tickSyntheticUser = scenarioAction({
  name: 'tickSyntheticUser',
  act: async (s, name: string) => {
    const { renewal } = await leasedSession(s, name);
    const actor = syntheticUserActor(name);
    await bringToFront(s, actor);
    const application = new SyntheticUserApplication(await actorUi(s, actor), {
      games: GAME_AUTOMATIONS,
      clock: s.harness.clock,
      random: () => 0,
      username: name,
      emit: () => undefined,
    });
    application.authenticated();
    try {
      await application.tick({
        paused: renewal.paused,
        draining: false,
        elapsedMs: 0,
        sessionMs: renewal.config.sessionMs,
      });
    } finally {
      application.close();
    }
  },
});

/** The Synthetic Users whose apps run on a device in this scenario. */
async function syntheticUsersWithApps(
  s: ProductHarness
): Promise<readonly string[]> {
  const rows = await s.harness.serverSql.sqlClient.query(
    sql<{
      username: string;
    }>`SELECT username FROM population_users WHERE device_id IS NOT NULL AND deleted_at IS NULL ORDER BY username`
  );
  return rows
    .map((row) => row.username)
    .filter((name) => s.actors.has(syntheticUserActor(name)));
}

/** Opens the controls for every Synthetic User; `false` when denied. */
async function openEveryControls(
  s: ProductHarness,
  actor: string
): Promise<boolean> {
  const ui = await actorUi(s, actor);
  await s.actors.get(actor)!.openLink('/admin/synthetic-population/control');
  await s.session.waitForIdle();
  if (await ui.get('synthetic-population-control-denied').isVisible())
    return false;
  await ui
    .get('synthetic-population-pause-all')
    .expect.visible({ timeoutMs: WAIT_MS });
  return true;
}

async function confirmEvery(
  s: ProductHarness,
  actor: string,
  command: 'pause-all' | 'resume-all'
): Promise<void> {
  const ui = await actorUi(s, actor);
  for (const id of ['synthetic-population-resume-all', 'synthetic-population-pause-all', 'synthetic-population', 'synthetic-population-control-denied', 'synthetic-population-users'])
    console.log('CPDEBUG', id, await ui.get(id).isVisible());
  await ui.get(`synthetic-population-${command}`).tap();
  for (const id of ['synthetic-population-resume-all-confirm', 'synthetic-population-every-done'])
    console.log('CPDEBUG2', id, await ui.get(id).isVisible());
  console.log('CPDEBUG3', (await s.actors.get(actor)!.currentPath()));
  await ui.get(`synthetic-population-${command}-confirm`).tap();
  await ui
    .get('synthetic-population-every-done')
    .expect.visible({ timeoutMs: WAIT_MS });
  await s.session.waitForIdle();
}

/**
 * The person pauses every Synthetic User; each running one is told on its
 * worker's next tick.
 */
export const pauseEverySyntheticUser = scenarioAction({
  name: 'pauseEverySyntheticUser',
  act: async (s, actor: string) => {
    if (!(await openEveryControls(s, actor))) return;
    await confirmEvery(s, actor, 'pause-all');
    for (const name of await syntheticUsersWithApps(s))
      await Promise.resolve(tickSyntheticUser.act(s, name));
  },
});

/** The person resumes every Synthetic User. */
export const resumeEverySyntheticUser = scenarioAction({
  name: 'resumeEverySyntheticUser',
  act: async (s, actor: string) => {
    if (!(await openEveryControls(s, actor))) return;
    await confirmEvery(s, actor, 'resume-all');
  },
});

/** Opens the Synthetic User's control panel; `false` when denied. */
async function openControlPanel(
  s: ProductHarness,
  actor: string,
  name: string
): Promise<boolean> {
  const user = await syntheticUserNamed(s, name);
  const ui = await actorUi(s, actor);
  await s.actors
    .get(actor)!
    .openLink(`/admin/synthetic-population/users/${user.id}`);
  await s.session.waitForIdle();
  return !(await ui.get('synthetic-population-inspect-denied').isVisible());
}

/** The person resumes one Synthetic User from its control panel. */
export const resumeSyntheticUser = scenarioAction({
  name: 'resumeSyntheticUser',
  act: async (s, actor: string, name: string) => {
    if (!(await openControlPanel(s, actor, name))) return;
    const ui = await actorUi(s, actor);
    await ui.get('synthetic-population-resume').tap();
    await ui
      .get('synthetic-population-availability')
      .expect.text('Synthetic Population stateAvailable');
    await s.session.waitForIdle();
  },
});

/**
 * The person restarts one Synthetic User from its control panel; its
 * worker closes and reopens its app and completes the command.
 */
export const restartSyntheticUser = scenarioAction({
  name: 'restartSyntheticUser',
  act: async (s, actor: string, name: string) => {
    if (!(await openControlPanel(s, actor, name))) return;
    const ui = await actorUi(s, actor);
    await ui.get('synthetic-population-restart').tap();
    await ui.get('synthetic-population-restart-confirm').tap();
    await ui
      .get('synthetic-population-restart-done')
      .expect.visible({ timeoutMs: WAIT_MS });
    const { lease, sessions, renewal } = await leasedSession(s, name);
    const restart = renewal.commands.find(
      (command) => command.command === 'restart'
    );
    if (restart === undefined) throw new Error(`${name} was not restarted`);
    const board = await syntheticGameView(s, syntheticUserActor(name));
    await Promise.resolve(reopenSyntheticApp.act(s, board.gameId));
    await sessions.completeCommand(lease, restart.id);
  },
});

/** Given: the named Synthetic Users run and are paused. */
export const givenPausedSyntheticUsers = scenarioAction({
  name: 'givenPausedSyntheticUsers',
  act: async (s, names: readonly string[]) => {
    for (const name of names)
      await Promise.resolve(givenSyntheticUser.act(s, name, false));
    const administration = new SyntheticPopulationAdministration(
      s.harness.serverSql.sqlClient,
      syntheticPopulationPorts(s)
    );
    for (const name of names) {
      const user = await syntheticUserNamed(s, name);
      const operationId = s.session.ports.createId();
      if (
        !(await administration.command(
          user.id,
          { operationId, command: 'pause' },
          s.session.ports.createId()
        ))
      )
        throw new Error(`${name} could not be paused`);
    }
  },
});

/** What the observer's directory says about the Synthetic User. */
async function directoryRow(
  s: ProductHarness,
  observer: string,
  name: string
): Promise<string> {
  const user = await syntheticUserNamed(s, name);
  const ui = await actorUi(s, observer);
  await s.actors.get(observer)!.openLink('/admin/synthetic-population');
  await s.session.waitForIdle();
  return (await ui.get(`synthetic-population-user-${user.id}`).text()) ?? '';
}

/** Whether the observer's directory shows the Synthetic User as paused. */
export async function syntheticUserPausedShown(
  s: ProductHarness,
  observer: string,
  name: string
): Promise<boolean> {
  return (await directoryRow(s, observer, name)).includes('Paused');
}

/** Whether the observer's directory shows the Synthetic User available. */
export async function syntheticUserAvailableShown(
  s: ProductHarness,
  observer: string,
  name: string
): Promise<boolean> {
  return !(await syntheticUserPausedShown(s, observer, name));
}

/** Whether the Synthetic User's app has ended its session (signed out). */
export async function syntheticSessionEnded(
  s: ProductHarness,
  name: string
): Promise<boolean> {
  const actor = syntheticUserActor(name);
  await bringToFront(s, actor);
  return (await actorUi(s, actor)).get(Handles.accountSignIn).isVisible();
}

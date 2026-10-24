import { GAME_AUTOMATIONS } from '@libs/game-catalog-shared-ts/game-automations';
import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { bringToFront } from '@libs/harness-ts/observations';
import { SyntheticPopulationSession } from '@libs/synthetic-population-server-ts/synthetic-population-session';
import type { ApplicationEvent } from '@libs/synthetic-population-shared-ts/application-events';
import { SyntheticUserApplication } from '@libs/synthetic-population-shared-ts/synthetic-user-application';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { playSyntheticCurrentGame } from './play-current-game';
import { syntheticGameView } from './synthetic-game-actions';
import { cedarUser, syntheticPopulationPorts } from './synthetic-user-fixtures';

async function leasedSyntheticSession(s: ProductHarness) {
  const user = await cedarUser(s);
  if (user.worker_id === null) throw new Error('Cedar has no Worker Lease');
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
  if (renewal === null) throw new Error('Cedar has lost its Worker Lease');
  return { lease, sessions, renewal };
}
export const pauseSyntheticUser = scenarioAction({
  name: 'pauseSyntheticUser',
  act: async (s, actor: string, name: string) => {
    if (name !== 'Cedar') throw new Error(`Unknown Synthetic User ${name}`);
    const user = await cedarUser(s);
    const ui = await actorUi(s, actor);
    await s.actors
      .get(actor)!
      .openLink(`/admin/synthetic-population/users/${user.id}`);
    if (await ui.get('synthetic-population-inspect-denied').isVisible()) return;
    await ui.get('synthetic-population-pause').tap();
    await ui
      .get('synthetic-population-availability')
      .expect.text('Synthetic Population statePaused');
    await s.session.waitForIdle();
    const game = await syntheticGameView(s);
    if (game.outcome === 'ongoing')
      await Promise.resolve(completeSyntheticGame.act(s));
    await Promise.resolve(finishPausedSession.act(s));
  },
});

export const completeSyntheticGame = scenarioAction({
  name: 'completeSyntheticGame',
  act: async (s) => {
    const { lease, sessions } = await leasedSyntheticSession(s);
    const events: ApplicationEvent[] = [];
    await playSyntheticCurrentGame(s, (event) => events.push(event));
    for (const event of events)
      await sessions.event({
        ...lease,
        version: 'spec',
        name: event.name,
        action: event.action,
        context: event.context,
      });
  },
});
export async function cedarGameResult(s: ProductHarness) {
  await bringToFront(s, 'bob');
  return syntheticGameView(s, 'bob');
}
export const finishPausedSession = scenarioAction({
  name: 'finishPausedSession',
  act: async (s) => {
    const { renewal } = await leasedSyntheticSession(s);
    await bringToFront(s, 'cedar');
    const application = new SyntheticUserApplication(
      await actorUi(s, 'cedar'),
      {
        games: GAME_AUTOMATIONS,
        clock: s.harness.clock,
        random: () => 0,
        username: 'Cedar',
        emit: () => undefined,
      }
    );
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
export async function cedarSessionEnded(s: ProductHarness) {
  await bringToFront(s, 'cedar');
  return (await actorUi(s, 'cedar')).get(Handles.accountSignIn).isVisible();
}
export async function cedarAvailable(s: ProductHarness, actor: string) {
  const user = await cedarUser(s);
  const ui = await actorUi(s, actor);
  await s.actors.get(actor)!.openLink('/admin/synthetic-population');
  const text = await ui.get(`synthetic-population-user-${user.id}`).text();
  return text?.includes('browsing') === true && !text.includes('Paused');
}

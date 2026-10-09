import { shownMultiplayerText } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { bringToFront } from '@libs/harness/observations';
import { PopulationSession } from '@libs/population-server/population-session';
import type { ApplicationEvent } from '@libs/population-shared/application-events';
import { SyntheticUserApplication } from '@libs/population-shared/synthetic-user-application';
import { Handles } from '@libs/test-ids-shared/handles';
import { cedarUser, populationPorts } from './synthetic-user-fixtures';

export const pauseSyntheticUser = scenarioAction({
  name: 'pauseSyntheticUser',
  act: async (s, actor: string, name: string) => {
    if (name !== 'Cedar') throw new Error(`Unknown Synthetic User ${name}`);
    const user = await cedarUser(s);
    const ui = await actorUi(s, actor);
    await s.actors.get(actor)!.openLink(`/admin/population/users/${user.id}`);
    if (await ui.get('population-inspect-denied').isVisible()) return;
    await ui.get('population-pause').tap();
    await ui
      .get('population-availability')
      .expect.text('Population statePaused');
  },
});

export const completePausedGame = scenarioAction({
  name: 'completePausedGame',
  act: async (s) => {
    const user = await cedarUser(s);
    if (user.worker_id === null) throw new Error('Cedar has no Worker Lease');
    const lease = {
      userId: user.id,
      workerId: user.worker_id,
      generation: user.generation,
    };
    const sessions = new PopulationSession(
      s.harness.serverSql.sqlClient,
      populationPorts(s)
    );
    const renewal = await sessions.renew(lease);
    if (renewal === null) throw new Error('Cedar has lost its Worker Lease');
    const events: ApplicationEvent[] = [];
    await bringToFront(s, 'cedar');
    const application = new SyntheticUserApplication(
      await actorUi(s, 'cedar'),
      {
        clock: s.harness.clock,
        random: () => 0,
        username: 'Cedar',
        emit: (event) => events.push(event),
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
      await s.session.waitForIdle();
      for (const event of events)
        await sessions.event({
          ...lease,
          version: 'spec',
          name: event.name,
          action: event.action,
          context: event.context,
        });
    } finally {
      application.close();
    }
  },
});
export async function cedarGameResult(s: ProductHarness) {
  return shownMultiplayerText(s, 'cedar', 'multiplayer-announcement');
}
export const finishPausedSession = scenarioAction({
  name: 'finishPausedSession',
  act: async (s) => {
    await bringToFront(s, 'cedar');
    const application = new SyntheticUserApplication(
      await actorUi(s, 'cedar'),
      {
        clock: s.harness.clock,
        random: () => 0,
        username: 'Cedar',
        emit: () => undefined,
      }
    );
    application.authenticated();
    try {
      await application.tick({
        paused: true,
        draining: false,
        elapsedMs: 0,
        sessionMs: 60_000,
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
  await s.actors.get(actor)!.openLink('/admin/population');
  const text = await ui.get(`population-user-${user.id}`).text();
  return text?.includes('browsing') === true && !text.includes('Paused');
}

import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  awaitChessMatch,
  givenMultiplayerPosition,
  givenOpponentSearch,
} from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import { givenMultiplayerSpace } from '@libs/chess-matchmaking-harness/multiplayer-spaces';
import { multiplayerWatcherBoard } from '@libs/chess-matchmaking-harness/multiplayer-watchers';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import type { ProductHarness } from '@libs/harness/harness';
import { signedInAccountOf } from '@libs/harness/identity';
import { setupPasswordAccount } from '@libs/harness/password-actions';
import { SyntheticPopulationController } from '@libs/synthetic-population-server/synthetic-population-controller';
import { SyntheticPopulationRepository } from '@libs/synthetic-population-server/synthetic-population-repository';
import { configureUsername } from '@libs/synthetic-population-shared/application-actions';
import sql from '@pkgs/sql-root-shared/sql';
import { bindFixtureAccount } from './fixture-account-binding';
import { maintainFixtureLease } from './fixture-lease-lifecycle';
import { givenDesiredSyntheticPopulation } from './observatory-actions';

export function syntheticPopulationPorts(s: ProductHarness) {
  return {
    clock: s.harness.clock,
    createId: s.session.ports.createId,
    notify: async () => undefined,
  };
}
export async function cedarUser(s: ProductHarness) {
  const users = await new SyntheticPopulationRepository(
    s.harness.serverSql.sqlClient,
    syntheticPopulationPorts(s)
  ).users();
  const cedar = users.find((user) => user.username === 'Cedar');
  if (cedar === undefined) throw new Error('Cedar was not provided');
  return cedar;
}
export const givenSyntheticUser = scenarioAction({
  name: 'givenSyntheticUser',
  act: async (s, name: string, playing: boolean) => {
    if (name !== 'Cedar') throw new Error(`Unknown Synthetic User ${name}`);
    await Promise.resolve(givenDesiredSyntheticPopulation.act(s, 1));
    const db = s.harness.serverSql.sqlClient;
    const ports = syntheticPopulationPorts(s);
    const controller = new SyntheticPopulationController(
      db,
      ports,
      'synthetic-population-spec-secret-0123456789abcdef'
    );
    const workerId = ports.createId();
    await controller.heartbeat({
      workerId,
      version: 'spec',
      capacity: 1,
      draining: false,
      memoryBytes: 1000,
      cpuMilliseconds: 0,
      leaseFailures: 0,
    });
    const assignment = await controller.claim(workerId);
    if (assignment === null) throw new Error('Cedar could not be assigned');
    maintainFixtureLease(s, assignment.lease);
    await Promise.resolve(
      setupPasswordAccount.act(
        s,
        'cedar',
        assignment.email,
        assignment.password
      )
    );
    const accountId = await signedInAccountOf(s, 'cedar');
    const deviceId = await s.actors.get('cedar')!.deviceId();
    const token = await s.actors.get('cedar')!.sessionToken();
    if (deviceId === null || token === null)
      throw new Error('Cedar did not authenticate');
    await bindFixtureAccount(s, { lease: assignment.lease, deviceId, token });
    await db.run(
      sql`UPDATE population_users SET username = ${name}, account_id = ${accountId}, device_id = ${deviceId}, activity = ${playing ? 'playing' : 'browsing'} WHERE id = ${assignment.lease.userId}`
    );
    await configureUsername(await actorUi(s, 'cedar'), 'cedar');
    if (!playing) return;
    // Both participants use the ordinary password flow; OAuth is covered by
    // the authentication specifications rather than this recovery fixture.
    await Promise.resolve(
      setupPasswordAccount.act(
        s,
        'bob',
        `${ports.createId()}@example.test`,
        `${ports.createId()}${ports.createId()}`
      )
    );
    await configureUsername(await actorUi(s, 'bob'), 'bob');
    for (const actor of ['cedar', 'bob']) {
      await Promise.resolve(givenMultiplayerSpace.act(s, actor));
      await Promise.resolve(givenOpponentSearch.act(s, actor));
    }
    await Promise.resolve(awaitChessMatch.act(s, 'cedar', 'bob', false));
    await Promise.resolve(openMultiplayerChess.act(s, 'cedar'));
    const gameId = await pollUntil(
      s,
      async () => (await multiplayerWatcherBoard(s, 'cedar')).gameId,
      { maxMs: 10_000, description: 'Cedar sees the assigned multiplayer game' }
    );
    const fen =
      'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2';
    await Promise.resolve(
      givenMultiplayerPosition.act(s, 'cedar', {
        gameId,
        fen,
      })
    );
    await Promise.resolve(openMultiplayerChess.act(s, 'cedar', gameId));
    await (await actorUi(s, 'cedar')).get('multiplayer-game').expect.visible();
    await pollUntil(
      s,
      async () => {
        const board = await multiplayerWatcherBoard(s, 'cedar');
        return board.gameId === gameId && board.fen === fen && board.canMove
          ? true
          : null;
      },
      {
        maxMs: 15_000,
        description: 'Cedar sees its supplied game position and turn',
      }
    );
  },
});

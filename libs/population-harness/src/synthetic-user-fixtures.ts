import { DEVICE_ID_KEY } from '@libs/auth-shared/auth-storage-keys';
import { openMultiplayerChess } from '@libs/chess-matchmaking-harness/multiplayer-actions';
import {
  awaitChessMatch,
  givenMultiplayerPosition,
  givenOpponentSearch,
} from '@libs/chess-matchmaking-harness/multiplayer-fixtures';
import { multiplayerView } from '@libs/chess-matchmaking-harness/multiplayer-reads';
import { givenMultiplayerSpace } from '@libs/chess-matchmaking-harness/multiplayer-spaces';
import { actorUi, scenarioAction } from '@libs/harness/actor-ui';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import { signedInAccountOf } from '@libs/harness/identity';
import { setupPasswordAccount } from '@libs/harness/password-actions';
import { PopulationController } from '@libs/population-server/population-controller';
import { PopulationRepository } from '@libs/population-server/population-repository';
import sql from '@pkgs/sql-root-shared/sql';
import { givenDesiredPopulation } from './observatory-actions';

export function populationPorts(s: ProductHarness) {
  return {
    clock: s.harness.clock,
    createId: s.session.ports.createId,
    notify: async () => undefined,
  };
}
export async function cedarUser(s: ProductHarness) {
  const users = await new PopulationRepository(
    s.harness.serverSql.sqlClient,
    populationPorts(s)
  ).users();
  const cedar = users.find((user) => user.username === 'Cedar');
  if (cedar === undefined) throw new Error('Cedar was not provided');
  return cedar;
}
export const givenSyntheticUser = scenarioAction({
  name: 'givenSyntheticUser',
  act: async (s, name: string, playing: boolean) => {
    if (name !== 'Cedar') throw new Error(`Unknown Synthetic User ${name}`);
    await Promise.resolve(givenDesiredPopulation.act(s, 1));
    const db = s.harness.serverSql.sqlClient;
    const ports = populationPorts(s);
    const controller = new PopulationController(
      db,
      ports,
      'population-spec-secret-0123456789abcdef'
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
    await Promise.resolve(
      setupPasswordAccount.act(
        s,
        'cedar',
        assignment.email,
        assignment.password
      )
    );
    const accountId = await signedInAccountOf(s, 'cedar');
    const deviceId = (await s.harness.client('cedar')).secureStorage.getValue(
      DEVICE_ID_KEY
    );
    await db.run(
      sql`UPDATE population_users SET username = ${name}, account_id = ${accountId}, device_id = ${deviceId}, activity = ${playing ? 'playing' : 'browsing'} WHERE id = ${assignment.lease.userId}`
    );
    if (!playing) return;
    await Promise.resolve(signInWithGoogle.act(s, 'bob'));
    for (const actor of ['cedar', 'bob']) {
      await Promise.resolve(givenMultiplayerSpace.act(s, actor));
      await Promise.resolve(givenOpponentSearch.act(s, actor));
    }
    await Promise.resolve(awaitChessMatch.act(s, 'cedar', 'bob', false));
    await Promise.resolve(openMultiplayerChess.act(s, 'cedar'));
    const game = (await multiplayerView(s, 'cedar')).game;
    if (game === null) throw new Error('Cedar was not matched');
    await Promise.resolve(
      givenMultiplayerPosition.act(s, 'cedar', {
        gameId: game.id,
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/6P1/5P2/PPPPP2P/RNBQKBNR b KQkq g3 0 2',
      })
    );
    await Promise.resolve(openMultiplayerChess.act(s, 'cedar', game.id));
    await (await actorUi(s, 'cedar')).get('multiplayer-game').expect.visible();
  },
});

import {
  awaitGameMatch,
  givenMultiplayerPosition,
  givenOpponentSearch,
} from '@libs/game-matchmaking-harness/multiplayer-fixtures';
import { actorUi, pollUntil, scenarioAction } from '@libs/harness/actor-ui';
import { signInWithGoogle } from '@libs/harness/auth-actions';
import type { ProductHarness } from '@libs/harness/harness';
import { signedInAccountOf } from '@libs/harness/identity';
import { SyntheticPopulationController } from '@libs/synthetic-population-server/synthetic-population-controller';
import { SyntheticPopulationRepository } from '@libs/synthetic-population-server/synthetic-population-repository';
import { configureUsername } from '@libs/synthetic-population-shared/application-actions';
import sql from '@pkgs/sql-root-shared/sql';
import { bindFixtureAccount } from './fixture-account-binding';
import { maintainFixtureLease } from './fixture-lease-lifecycle';
import { givenDesiredSyntheticPopulation } from './observatory-actions';
import {
  givenSyntheticGameSpace,
  openSyntheticGame,
  syntheticGame,
  syntheticGameView,
} from './synthetic-game-actions';
import {
  givenSyntheticUserDevice,
  signInSyntheticUser,
  syntheticUserActor,
  syntheticUserSignIn,
} from './synthetic-sign-in-actions';

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
/**
 * A Synthetic User a worker holds the lease for, on its own application
 * host, that has not signed in: what a deployed worker has right after it
 * claims a user.
 */
export const givenLeasedSyntheticUser = scenarioAction({
  name: 'givenLeasedSyntheticUser',
  act: async (s, name: string) => {
    if (name !== 'Cedar') throw new Error(`Unknown Synthetic User ${name}`);
    await Promise.resolve(givenDesiredSyntheticPopulation.act(s, 1));
    const db = s.harness.serverSql.sqlClient;
    const ports = syntheticPopulationPorts(s);
    const controller = new SyntheticPopulationController(db, ports);
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
    if (assignment === null) throw new Error(`${name} could not be assigned`);
    maintainFixtureLease(s, assignment.lease);
    await db.run(
      sql`UPDATE population_users SET username = ${name} WHERE id = ${assignment.lease.userId}`
    );
    await Promise.resolve(
      givenSyntheticUserDevice.act(s, syntheticUserActor(name))
    );
  },
});
/** The clock namespace of the synthetic game's opponent searches. */
function syntheticClockNamespace(game: string): string {
  const matchmaking =
    syntheticGame(game).shared.turnGame.capabilities.matchmaking;
  if (matchmaking === undefined)
    throw new Error(`${game} offers no matchmaking to play`);
  return matchmaking.clockNamespace;
}
export const givenSyntheticUser = scenarioAction({
  name: 'givenSyntheticUser',
  act: async (s, name: string, playing: boolean, game?: string) => {
    const label = syntheticGame(game).label;
    await Promise.resolve(givenLeasedSyntheticUser.act(s, name));
    const db = s.harness.serverSql.sqlClient;
    const user = await syntheticUserSignIn(s, name);
    // Cedar signs in as a deployed Synthetic User does: on its own host, by
    // the link in its internal inbox.
    await Promise.resolve(signInSyntheticUser.act(s, 'cedar', user));
    const accountId = await signedInAccountOf(s, 'cedar');
    const deviceId = await s.actors.get('cedar')!.deviceId();
    const token = await s.actors.get('cedar')!.sessionToken();
    if (deviceId === null || token === null)
      throw new Error('Cedar did not authenticate');
    await bindFixtureAccount(s, { lease: user.lease, deviceId, token });
    await db.run(
      sql`UPDATE population_users SET account_id = ${accountId}, device_id = ${deviceId}, activity = ${playing ? 'playing' : 'browsing'} WHERE id = ${user.lease.userId}`
    );
    await configureUsername(await actorUi(s, 'cedar'), 'cedar');
    if (!playing) return;
    // Bob is a person: people sign in with a provider, never by email.
    await Promise.resolve(signInWithGoogle.act(s, 'bob'));
    await pollUntil(
      s,
      async () => (await signedInAccountOf(s, 'bob')) ?? null,
      {
        maxMs: 20_000,
        description: "Bob's account is ready",
      }
    );
    await configureUsername(await actorUi(s, 'bob'), 'bob');
    for (const actor of ['cedar', 'bob']) {
      await Promise.resolve(givenSyntheticGameSpace.act(s, actor, label));
      await Promise.resolve(
        givenOpponentSearch.act(
          s,
          actor,
          `${syntheticClockNamespace(label)}5+0`
        )
      );
    }
    // Cedar plays the first side, from one move before the game's known
    // victory, so its next move can finish the game.
    await Promise.resolve(awaitGameMatch.act(s, 'cedar', 'bob', true));
    await Promise.resolve(openSyntheticGame.act(s, 'cedar', label));
    const gameId = await pollUntil(
      s,
      async () => (await syntheticGameView(s, 'cedar')).gameId,
      { maxMs: 10_000, description: 'Cedar sees the assigned multiplayer game' }
    );
    const victory = syntheticGame(label).fixtures.firstSideVictory;
    const fen = syntheticGame(label).shared.turnGame.rules.replay(
      victory,
      victory.length - 1
    );
    await Promise.resolve(
      givenMultiplayerPosition.act(s, 'cedar', {
        gameId,
        fen,
      })
    );
    await Promise.resolve(openSyntheticGame.act(s, 'cedar', label));
    await (await actorUi(s, 'cedar')).get('multiplayer-game').expect.visible();
    await pollUntil(
      s,
      async () => {
        const board = await syntheticGameView(s, 'cedar');
        return board.gameId === gameId &&
          board.position === fen &&
          board.canMove
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

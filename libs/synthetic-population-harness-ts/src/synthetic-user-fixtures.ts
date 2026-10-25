import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import { SyntheticPopulationController } from '@libs/synthetic-population-server-ts/synthetic-population-controller';
import { SyntheticPopulationRepository } from '@libs/synthetic-population-server-ts/synthetic-population-repository';
import { configureUsername } from '@libs/synthetic-population-shared-ts/application-actions';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { bindFixtureAccount } from './fixture-account-binding';
import { maintainFixtureLease } from './fixture-lease-lifecycle';
import { givenDesiredSyntheticPopulation } from './observatory-actions';
import { syntheticGame } from './synthetic-game-actions';
import { prepareSyntheticMatch } from './synthetic-match-fixtures';
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
    await prepareSyntheticMatch(s, label);
  },
});

import { actorUi, scenarioAction } from '@libs/harness-ts/actor-ui';
import type { ProductHarness } from '@libs/harness-ts/harness';
import { signedInAccountOf } from '@libs/harness-ts/identity';
import {
  runScopedCreateId,
  runScopedUsername,
} from '@libs/harness-ts/run-scope';
import { configureUsername } from '@libs/synthetic-population-behavior-shared-ts/application-actions';
import { SyntheticPopulationController } from '@libs/synthetic-population-server-ts/synthetic-population-controller';
import { SyntheticPopulationRepository } from '@libs/synthetic-population-server-ts/synthetic-population-repository';
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
    createId: runScopedCreateId(s),
    notify: async () => undefined,
  };
}
export async function cedarUser(s: ProductHarness) {
  return syntheticUserNamed(s, 'Cedar');
}
/** The provisioned Synthetic User the scenario calls `name`. */
export async function syntheticUserNamed(s: ProductHarness, name: string) {
  const users = await new SyntheticPopulationRepository(
    s.harness.serverSql.sqlClient,
    syntheticPopulationPorts(s)
  ).users();
  const user = users.find((candidate) => candidate.username === name);
  if (user === undefined) throw new Error(`${name} was not provided`);
  return user;
}
/**
 * A Synthetic User a worker holds the lease for, on its own application
 * host, that has not signed in: what a deployed worker has right after it
 * claims a user.
 */
export const givenLeasedSyntheticUser = scenarioAction({
  name: 'givenLeasedSyntheticUser',
  act: async (s, name: string) => {
    const db = s.harness.serverSql.sqlClient;
    const ports = syntheticPopulationPorts(s);
    // One more Synthetic User than the scenario has already named.
    const named = await db.query(
      sql<{
        id: string;
      }>`SELECT id FROM population_users WHERE worker_id IS NOT NULL AND deleted_at IS NULL`
    );
    await Promise.resolve(
      givenDesiredSyntheticPopulation.act(s, named.length + 1)
    );
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
    const actor = syntheticUserActor(name);
    await Promise.resolve(givenLeasedSyntheticUser.act(s, name));
    const db = s.harness.serverSql.sqlClient;
    const user = await syntheticUserSignIn(s, name);
    // It signs in as a deployed Synthetic User does: on its own host, by
    // the link in its internal inbox.
    await Promise.resolve(signInSyntheticUser.act(s, actor, user));
    const accountId = await signedInAccountOf(s, actor);
    const deviceId = await s.actors.get(actor)!.deviceId();
    const token = await s.actors.get(actor)!.sessionToken();
    if (deviceId === null || token === null)
      throw new Error(`${name} did not authenticate`);
    await bindFixtureAccount(s, { lease: user.lease, deviceId, token });
    await db.run(
      sql`UPDATE population_users SET account_id = ${accountId}, device_id = ${deviceId}, activity = ${playing ? 'playing' : 'browsing'} WHERE id = ${user.lease.userId}`
    );
    await configureUsername(
      await actorUi(s, actor),
      runScopedUsername(s, actor)
    );
    if (!playing) return;
    await prepareSyntheticMatch(s, label);
  },
});

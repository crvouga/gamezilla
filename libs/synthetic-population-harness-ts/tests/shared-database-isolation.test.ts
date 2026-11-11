import { expect, test } from 'bun:test';
import { taggedCreateId } from '@libs/harness-ts/run-scope';
import { PROFILE_TABLES } from '@libs/profile-shared-ts/tables';
import { retireEarlierPopulation } from '@libs/synthetic-population-harness-ts/population-baseline';
import { SyntheticPopulationAdministration } from '@libs/synthetic-population-server-ts/synthetic-population-administration';
import { SyntheticPopulationController } from '@libs/synthetic-population-server-ts/synthetic-population-controller';
import { SyntheticPopulationRepository } from '@libs/synthetic-population-server-ts/synthetic-population-repository';
import { DEFAULT_SYNTHETIC_POPULATION_CONFIG } from '@libs/synthetic-population-shared-ts/config';
import { SYNTHETIC_POPULATION_TABLES } from '@libs/synthetic-population-shared-ts/tables';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { registerTables } from '@pkgs/db-schema-root-shared-ts/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared-ts/reconcile-sqlite-schema';
import type { SqlClient } from '@pkgs/sql-client-root-shared-ts/interface';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared-ts/impl-mockingbird-sqlite';
import sql, { raw } from '@pkgs/sql-root-shared-ts/sql';
import { createHarnessIds } from '@pkgs/uuid-shared-ts/seeded-create-id';

/** Every scenario of a run uses the same seed: its ids repeat run to run. */
const SCENARIO_SEED = 1;

/** One database serving every scenario, as a localhost stack's does. */
async function stackDatabase() {
  const { clock } = createHarnessClock({ startMs: Date.UTC(2026, 0, 1) });
  const db = SqlClientImplMockingbirdSqlite.open({
    seed: 7,
    now: () => new Date(clock.now()),
  });
  await reconcileSqliteSchema(
    db,
    registerTables([...SYNTHETIC_POPULATION_TABLES, ...PROFILE_TABLES])
  );
  // The stack boots configured for its own workers' version.
  const ports = {
    clock,
    createId: createHarnessIds('stack').createId,
    notify: async () => undefined,
  };
  await new SyntheticPopulationAdministration(db, ports).configure(
    { ...DEFAULT_SYNTHETIC_POPULATION_CONFIG, preferredVersion: 'local' },
    'localhost-stack'
  );
  return { db, clock };
}

/** A scenario's fixtures on that database: the run's tag on every id. */
function scenarioWorld(
  stack: Awaited<ReturnType<typeof stackDatabase>>,
  tag: string
) {
  const ports = {
    clock: stack.clock,
    createId: taggedCreateId(createHarnessIds(SCENARIO_SEED).createId, tag),
    notify: async () => undefined,
  };
  const db: SqlClient = stack.db;
  return {
    ports,
    controller: new SyntheticPopulationController(db, ports),
    repo: new SyntheticPopulationRepository(db, ports),
    admin: new SyntheticPopulationAdministration(db, ports),
  };
}

type World = ReturnType<typeof scenarioWorld>;

/** What the leased-Synthetic-User fixture does: one more online, Cedar. */
async function leaseCedar(world: World) {
  const config = await world.repo.config();
  await world.admin.configure(
    { ...config, desired: 1 },
    world.ports.createId()
  );
  const workerId = world.ports.createId();
  await world.controller.heartbeat({
    workerId,
    version: 'spec',
    capacity: 1,
    draining: false,
    memoryBytes: 1000,
    cpuMilliseconds: 0,
    leaseFailures: 0,
  });
  return world.controller.claim(workerId);
}

// regression: stack-population-fixture-collisions
test('scenarios side by side on one database mint no common population row', async () => {
  const stack = await stackDatabase();
  const worlds = [
    scenarioWorld(stack, 'aaaa0001'),
    scenarioWorld(stack, 'bbbb0002'),
  ];
  await Promise.all(
    worlds.map(async (world) => {
      await world.controller.heartbeat({
        workerId: world.ports.createId(),
        version: 'spec',
        capacity: 1,
        draining: false,
        memoryBytes: 1000,
        cpuMilliseconds: 0,
        leaseFailures: 0,
      });
      await world.repo.event({ name: 'FixtureStarted' });
      await world.repo.event({ name: 'FixtureContinued' });
    })
  );
  const events = await stack.db.query(
    sql<{
      id: string;
    }>`SELECT id FROM population_events WHERE event LIKE ${'Fixture%'}`
  );
  expect(new Set(events.map((event) => event.id)).size).toBe(4);
  const workers = await worlds[0]!.repo.workers();
  expect(new Set(workers.map((worker) => worker.id)).size).toBe(2);
});

// regression: stack-population-fixture-collisions
test('a scenario after another on one database starts from a fresh Synthetic Population', async () => {
  const stack = await stackDatabase();
  const first = scenarioWorld(stack, 'aaaa0001');
  await retireEarlierPopulation(stack.db, first.ports);
  expect(await first.repo.config()).toMatchObject({
    ...DEFAULT_SYNTHETIC_POPULATION_CONFIG,
    revision: expect.any(Number),
  });
  expect(await leaseCedar(first)).not.toBeNull();

  const second = scenarioWorld(stack, 'bbbb0002');
  await retireEarlierPopulation(stack.db, second.ports);
  expect(await second.repo.users()).toEqual([]);
  expect((await second.repo.counts()).online).toBe(0);
  expect((await second.repo.config()).desired).toBe(0);
  const assignment = await leaseCedar(second);
  expect(assignment).not.toBeNull();
  expect((await second.repo.users()).map((user) => user.id)).toEqual([
    assignment!.lease.userId,
  ]);
});

test('a world on a fresh database finds no population to retire', async () => {
  const { clock } = createHarnessClock({ startMs: Date.UTC(2026, 0, 1) });
  const db = SqlClientImplMockingbirdSqlite.open({
    seed: 7,
    now: () => new Date(clock.now()),
  });
  await reconcileSqliteSchema(
    db,
    registerTables([...SYNTHETIC_POPULATION_TABLES])
  );
  const ports = {
    clock,
    createId: createHarnessIds(SCENARIO_SEED).createId,
    notify: async () => undefined,
  };
  await retireEarlierPopulation(db, ports);
  for (const table of SYNTHETIC_POPULATION_TABLES)
    expect(
      await db.query(sql<{ id: string }>`SELECT id FROM ${raw(table.name)}`)
    ).toEqual([]);
});

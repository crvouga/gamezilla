import { LeaseRepository } from '@libs/population-server/lease-repository';
import { PopulationAdministration } from '@libs/population-server/population-administration';
import { PopulationController } from '@libs/population-server/population-controller';
import { PopulationRepository } from '@libs/population-server/population-repository';
import { PopulationSession } from '@libs/population-server/population-session';
import { DEFAULT_POPULATION_CONFIG } from '@libs/population-shared/config';
import { POPULATION_TABLES } from '@libs/population-shared/tables';
import { createHarnessClock } from '@pkgs/clock-shared/harness-clock';
import { registerTables } from '@pkgs/db-schema-root-shared/register-tables';
import { reconcileSqliteSchema } from '@pkgs/db-schema-sqlite-shared/reconcile-sqlite-schema';
import { SqlClientImplMockingbirdSqlite } from '@pkgs/sql-client-sqlite-root-shared/impl-mockingbird-sqlite';
import { createHarnessIds } from '@pkgs/uuid-shared/seeded-create-id';

export async function populationFixture(desired = 1) {
  const { clock, timers } = createHarnessClock({
    startMs: Date.UTC(2026, 0, 1),
  });
  const { createId } = createHarnessIds(213);
  const db = SqlClientImplMockingbirdSqlite.open({
    seed: 213,
    now: () => new Date(clock.now()),
  });
  await reconcileSqliteSchema(db, registerTables(POPULATION_TABLES));
  let notifications = 0;
  const ports = {
    clock,
    createId,
    notify: async () => {
      notifications += 1;
    },
  };
  const admin = new PopulationAdministration(db, ports);
  const controller = new PopulationController(
    db,
    ports,
    'population-fixture-secret-0123456789abcdef'
  );
  const repo = new PopulationRepository(db, ports);
  const leases = new LeaseRepository(db, ports);
  const sessions = new PopulationSession(db, ports);
  await admin.configure(
    { ...DEFAULT_POPULATION_CONFIG, desired, capacityPerWorker: 2 },
    createId()
  );
  const workers = [createId(), createId()];
  const heartbeat = (workerId: string, version = 'v1', draining = false) =>
    controller.heartbeat({
      workerId,
      version,
      capacity: 2,
      draining,
      memoryBytes: 1000,
      cpuMilliseconds: 0,
      leaseFailures: 0,
    });
  for (const worker of workers) await heartbeat(worker);
  return {
    clock,
    timers,
    createId,
    db,
    ports,
    admin,
    controller,
    repo,
    leases,
    sessions,
    workers,
    heartbeat,
    notifications: () => notifications,
  };
}

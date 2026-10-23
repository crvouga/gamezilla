import type { SyntheticPopulationConfig } from '@libs/synthetic-population-shared-ts/config';
import {
  type Personality,
  personalitySchema,
  provisionPersonality,
} from '@libs/synthetic-population-shared-ts/personality';
import { syntheticAddress } from '@libs/synthetic-population-shared-ts/synthetic-address';
import type {
  SqlClient,
  SqlTx,
} from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { LeaseRepository } from './lease-repository';
import type {
  Lease,
  SyntheticPopulationPorts,
  WorkerHeartbeat,
} from './records';
import { isoAt, jsonValue } from './records';
import { SyntheticPopulationRepository } from './synthetic-population-repository';

type AssignmentRow = {
  id: string;
  username: string;
  email: string;
  checkpoint: unknown;
  account_id: string | null;
  paused: boolean;
  personality: unknown;
};
type ClaimedAssignment = {
  user: AssignmentRow;
  lease: NonNullable<Awaited<ReturnType<LeaseRepository['acquire']>>>;
  config: SyntheticPopulationConfig;
};
export type Assignment = {
  lease: Lease;
  deviceId: string;
  username: string;
  email: string;
  /** The user already has an account: this session restores it. */
  registered: boolean;
  checkpoint: unknown;
  config: SyntheticPopulationConfig;
  personality: Personality;
};

export class SyntheticPopulationController {
  constructor(
    private readonly db: SqlClient,
    private readonly ports: SyntheticPopulationPorts
  ) {}

  async heartbeat(value: WorkerHeartbeat) {
    const now = isoAt(this.ports.clock.now());
    await this.db.run(
      sql`INSERT INTO population_workers (id, created_at, updated_at, application_version, capacity, draining, heartbeat_at, memory_bytes, cpu_milliseconds, lease_failures) VALUES (${value.workerId}, ${now}, ${now}, ${value.version}, ${value.capacity}, ${value.draining}, ${now}, ${value.memoryBytes}, ${value.cpuMilliseconds}, ${value.leaseFailures}) ON CONFLICT (id) DO UPDATE SET application_version = ${value.version}, capacity = ${value.capacity}, draining = ${value.draining}, heartbeat_at = ${now}, memory_bytes = ${value.memoryBytes}, cpu_milliseconds = ${value.cpuMilliseconds}, lease_failures = ${value.leaseFailures}, updated_at = ${now}`
    );
    await this.ports.notify();
    return new SyntheticPopulationRepository(this.db, this.ports).config();
  }

  private async provision(tx: SqlTx): Promise<AssignmentRow> {
    const id = this.ports.createId();
    const username = `cedar${id.replaceAll('-', '').slice(0, 8)}`;
    const email = syntheticAddress(id);
    const now = isoAt(this.ports.clock.now());
    const personality = provisionPersonality(id);
    await tx.run(
      sql`INSERT INTO population_users (id, created_at, updated_at, username, email, region, personality, paused, generation, activity) VALUES (${id}, ${now}, ${now}, ${username}, ${email}, ${'global'}, ${JSON.stringify(personality)}, ${false}, 0, ${'offline'})`
    );
    return {
      id,
      username,
      email,
      checkpoint: null,
      account_id: null,
      paused: false,
      personality,
    };
  }

  async claim(workerId: string): Promise<Assignment | null> {
    let assigned: ClaimedAssignment | null;
    try {
      assigned = await this.claimAssignment(workerId);
    } catch (error) {
      // A competing claim committed first. The transaction was rolled back;
      // this worker remains unassigned until its next ordinary claim cycle.
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === '40001'
      )
        return null;
      throw error;
    }
    if (assigned === null) return null;
    await this.ports.notify();
    return {
      lease: assigned.lease,
      deviceId: assigned.lease.deviceId,
      username: assigned.user.username,
      email: assigned.user.email,
      registered: assigned.user.account_id !== null,
      checkpoint: assigned.user.checkpoint,
      config: assigned.config,
      personality: personalitySchema.parse(
        jsonValue(assigned.user.personality)
      ),
    };
  }

  private async claimAssignment(
    workerId: string
  ): Promise<ClaimedAssignment | null> {
    return this.db.transaction(async (tx) => {
      const repo = new SyntheticPopulationRepository(tx, this.ports);
      await repo.initialize();
      // A portable row lock serializes capacity and desired-population admission.
      // The lease itself still uses CAS: workers never depend on replica indices.
      await tx.run(
        sql`UPDATE population_config SET revision = revision WHERE id = ${'default'}`
      );
      const config = await repo.config();
      const now = isoAt(this.ports.clock.now());
      const alive = isoAt(this.ports.clock.now() - config.leaseMs);
      const workers = await tx.query(
        sql<{
          capacity: number;
          application_version: string;
        }>`SELECT capacity, application_version FROM population_workers WHERE id = ${workerId} AND draining = ${false} AND heartbeat_at > ${alive} AND deleted_at IS NULL`
      );
      const worker = workers[0];
      if (
        worker === undefined ||
        (config.preferredVersion !== '' &&
          worker.application_version !== config.preferredVersion)
      )
        return null;
      const counts = await tx.query(
        sql<{
          total: number;
          owned: number;
        }>`SELECT COUNT(*) AS total, SUM(CASE WHEN worker_id = ${workerId} THEN 1 ELSE 0 END) AS owned FROM population_users WHERE worker_id IS NOT NULL AND lease_until > ${now} AND deleted_at IS NULL`
      );
      if (
        Number(counts[0]?.total ?? 0) >= config.desired ||
        Number(counts[0]?.owned ?? 0) >=
          Math.min(worker.capacity, config.capacityPerWorker)
      )
        return null;
      const candidates = await tx.query(
        sql<AssignmentRow>`SELECT id, username, email, checkpoint, account_id, paused, personality FROM population_users WHERE paused = ${false} AND deleted_at IS NULL AND (worker_id IS NULL OR lease_until <= ${now}) ORDER BY created_at, id LIMIT 1`
      );
      const user = candidates[0] ?? (await this.provision(tx));
      const lease = await new LeaseRepository(tx, this.ports).acquire(
        user.id,
        workerId,
        config.leaseMs
      );
      if (lease === null) return null;
      await repo.event({
        userId: user.id,
        workerId,
        generation: lease.generation,
        version: worker.application_version,
        name: 'WorkerLeaseAcquired',
      });
      return { user, lease, config };
    });
  }
}

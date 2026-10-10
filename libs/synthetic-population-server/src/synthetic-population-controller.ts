import type { SyntheticPopulationConfig } from '@libs/synthetic-population-shared/config';
import {
  type Personality,
  personalitySchema,
  provisionPersonality,
} from '@libs/synthetic-population-shared/personality';
import type { SqlClient, SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import { openCredential, sealCredential } from './credential-vault';
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
  credential: string;
  checkpoint: unknown;
  account_id: string | null;
  paused: boolean;
  personality: unknown;
};
export type Assignment = {
  lease: Lease;
  deviceId: string;
  username: string;
  email: string;
  password: string;
  registered: boolean;
  checkpoint: unknown;
  config: SyntheticPopulationConfig;
  personality: Personality;
};

export class SyntheticPopulationController {
  constructor(
    private readonly db: SqlClient,
    private readonly ports: SyntheticPopulationPorts,
    private readonly credentialSecret: string
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
    const email = `${id}@synthetic.gamezilla.invalid`;
    const credential = await sealCredential(
      this.credentialSecret,
      id,
      `${this.ports.createId()}-${this.ports.createId()}`,
      this.ports.createId
    );
    const now = isoAt(this.ports.clock.now());
    const personality = provisionPersonality(id);
    await tx.run(
      sql`INSERT INTO population_users (id, created_at, updated_at, username, email, credential, region, personality, paused, generation, activity) VALUES (${id}, ${now}, ${now}, ${username}, ${email}, ${credential}, ${'global'}, ${JSON.stringify(personality)}, ${false}, 0, ${'offline'})`
    );
    return {
      id,
      username,
      email,
      credential,
      checkpoint: null,
      account_id: null,
      paused: false,
      personality,
    };
  }

  async claim(workerId: string): Promise<Assignment | null> {
    const assigned = await this.db.transaction(async (tx) => {
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
        sql<AssignmentRow>`SELECT id, username, email, credential, checkpoint, account_id, paused, personality FROM population_users WHERE paused = ${false} AND deleted_at IS NULL AND (worker_id IS NULL OR lease_until <= ${now}) ORDER BY created_at, id LIMIT 1`
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
    if (assigned === null) return null;
    await this.ports.notify();
    return {
      lease: assigned.lease,
      deviceId: assigned.lease.deviceId,
      username: assigned.user.username,
      email: assigned.user.email,
      password: await openCredential(
        this.credentialSecret,
        assigned.user.id,
        assigned.user.credential
      ),
      registered: assigned.user.account_id !== null,
      checkpoint: assigned.user.checkpoint,
      config: assigned.config,
      personality: personalitySchema.parse(
        jsonValue(assigned.user.personality)
      ),
    };
  }
}

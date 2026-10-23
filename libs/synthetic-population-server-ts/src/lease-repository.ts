import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type { Lease, SyntheticPopulationPorts } from './records';
import { isoAt } from './records';

export class LeaseRepository {
  constructor(
    private readonly tx: SqlTx,
    private readonly ports: SyntheticPopulationPorts
  ) {}

  /** CAS includes expiry and generation. An expired owner cannot renew itself. */
  async acquire(
    userId: string,
    workerId: string,
    leaseMs: number
  ): Promise<(Lease & { deviceId: string }) | null> {
    const now = isoAt(this.ports.clock.now());
    const expiresAt = isoAt(this.ports.clock.now() + leaseMs);
    const deviceId = this.ports.createId();
    const rows = await this.tx.query(
      sql<{
        generation: number;
      }>`UPDATE population_users SET worker_id = ${workerId}, device_id = ${deviceId}, generation = generation + 1, lease_until = ${expiresAt}, activity = ${'recovering'}, inspection = ${null}, updated_at = ${now} WHERE id = ${userId} AND deleted_at IS NULL AND paused = ${false} AND (worker_id IS NULL OR lease_until <= ${now}) RETURNING generation`
    );
    const generation = rows[0]?.generation;
    return generation === undefined
      ? null
      : { userId, workerId, generation, expiresAt, deviceId };
  }

  async renew(
    lease: Omit<Lease, 'expiresAt'>,
    leaseMs: number
  ): Promise<string | null> {
    const now = isoAt(this.ports.clock.now());
    const until = isoAt(this.ports.clock.now() + leaseMs);
    const rows = await this.tx.query(
      sql<{
        id: string;
      }>`UPDATE population_users SET lease_until = ${until}, updated_at = ${now} WHERE id = ${lease.userId} AND worker_id = ${lease.workerId} AND generation = ${lease.generation} AND lease_until > ${now} AND deleted_at IS NULL RETURNING id`
    );
    return rows.length === 0 ? null : until;
  }

  async owned(lease: Omit<Lease, 'expiresAt'>): Promise<boolean> {
    const now = isoAt(this.ports.clock.now());
    const rows = await this.tx.query(
      sql<{
        id: string;
      }>`SELECT id FROM population_users WHERE id = ${lease.userId} AND worker_id = ${lease.workerId} AND generation = ${lease.generation} AND lease_until > ${now} AND deleted_at IS NULL`
    );
    return rows.length === 1;
  }

  /** The runtime must close its application before calling this method. */
  async release(lease: Omit<Lease, 'expiresAt'>): Promise<boolean> {
    const rows = await this.tx.query(
      sql<{
        id: string;
      }>`UPDATE population_users SET worker_id = ${null}, lease_until = ${null}, activity = ${'offline'}, inspection = ${null}, updated_at = ${isoAt(this.ports.clock.now())} WHERE id = ${lease.userId} AND worker_id = ${lease.workerId} AND generation = ${lease.generation} RETURNING id`
    );
    return rows.length === 1;
  }
}

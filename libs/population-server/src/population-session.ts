import {
  type Checkpoint,
  checkpointSchema,
} from '@libs/population-shared/config';
import { inspectionSchema } from '@libs/population-shared/inspection';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import { LeaseRepository } from './lease-repository';
import { PopulationRepository } from './population-repository';
import type { Lease, PopulationPorts } from './records';
import { isoAt, jsonValue } from './records';

type Ownership = Omit<Lease, 'expiresAt'>;
export class PopulationSession {
  constructor(
    private readonly db: SqlClient,
    private readonly ports: PopulationPorts
  ) {}

  async event(
    input: Ownership & {
      version: string;
      name: string;
      action: string | null;
      context?: Record<string, unknown>;
    }
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      await tx.run(
        sql`UPDATE population_users SET generation = generation WHERE id = ${input.userId}`
      );
      if (!(await new LeaseRepository(tx, this.ports).owned(input)))
        return false;
      await new PopulationRepository(tx, this.ports).event({
        ...input,
        context: { ...input.context, action: input.action },
      });
      return true;
    });
  }

  async renew(lease: Ownership) {
    const config = await new PopulationRepository(this.db, this.ports).config();
    const expiresAt = await new LeaseRepository(this.db, this.ports).renew(
      lease,
      config.leaseMs
    );
    if (expiresAt === null) return null;
    const rows = await this.db.query(
      sql<{
        paused: boolean;
        inspection_requested_at: string | null;
      }>`SELECT paused, inspection_requested_at FROM population_users WHERE id = ${lease.userId}`
    );
    const commands = await this.db.query(
      sql<{
        id: string;
        command: string;
      }>`SELECT id, command FROM population_commands WHERE user_id = ${lease.userId} AND completed_at IS NULL AND deleted_at IS NULL ORDER BY created_at, id LIMIT 20`
    );
    const admission = await this.db.query(
      sql<{
        position: number;
      }>`SELECT COUNT(*) AS position FROM population_users WHERE worker_id IS NOT NULL AND lease_until > ${isoAt(this.ports.clock.now())} AND deleted_at IS NULL AND id <= ${lease.userId}`
    );
    return {
      expiresAt,
      paused: Boolean(rows[0]?.paused),
      inspectionRequestedAt: rows[0]?.inspection_requested_at ?? null,
      commands,
      config,
      draining: Number(admission[0]?.position ?? 0) > config.desired,
    };
  }

  async checkpoint(
    input: Ownership & {
      checkpoint: Checkpoint;
      version: string;
      action: string | null;
      error: string | null;
    }
  ): Promise<boolean> {
    const { checkpoint, version, action, error } = input;
    const lease = input;
    const value = checkpointSchema.parse(checkpoint);
    const now = isoAt(this.ports.clock.now());
    const rows = await this.db.query(
      sql<{
        id: string;
      }>`UPDATE population_users SET checkpoint = ${JSON.stringify(value)}, activity = ${value.activity}, application_version = ${version}, last_action = ${action}, last_error = ${error}, updated_at = ${now} WHERE id = ${lease.userId} AND worker_id = ${lease.workerId} AND generation = ${lease.generation} AND lease_until > ${now} AND deleted_at IS NULL RETURNING id`
    );
    if (rows.length > 0) await this.ports.notify();
    return rows.length > 0;
  }

  async completeCommand(
    lease: Ownership,
    operationId: string
  ): Promise<boolean> {
    return this.db.transaction(async (tx) => {
      if (!(await new LeaseRepository(tx, this.ports).owned(lease)))
        return false;
      const now = isoAt(this.ports.clock.now());
      const rows = await tx.query(
        sql<{
          id: string;
        }>`UPDATE population_commands SET completed_at = ${now}, updated_at = ${now} WHERE id = ${operationId} AND user_id = ${lease.userId} AND completed_at IS NULL RETURNING id`
      );
      return rows.length > 0;
    });
  }

  async inspection(
    lease: Ownership,
    requestedAt: string,
    value: unknown
  ): Promise<boolean> {
    const now = isoAt(this.ports.clock.now());
    const parsed = inspectionSchema.safeParse(jsonValue(value));
    if (!parsed.success || parsed.data.generation !== lease.generation)
      return false;
    const snapshot = JSON.stringify(parsed.data);
    const rows = await this.db.query(
      sql<{
        id: string;
      }>`UPDATE population_users SET inspection = ${snapshot}, inspection_requested_at = ${null}, updated_at = ${now} WHERE id = ${lease.userId} AND worker_id = ${lease.workerId} AND generation = ${lease.generation} AND lease_until > ${now} AND inspection_requested_at = ${requestedAt} RETURNING id`
    );
    return rows.length > 0;
  }
}

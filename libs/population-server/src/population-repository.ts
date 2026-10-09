import {
  DEFAULT_POPULATION_CONFIG,
  type PopulationConfig,
  populationConfigSchema,
} from '@libs/population-shared/config';
import type { SqlTx } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import type {
  ConfigurationRecord,
  EventRecord,
  PopulationPorts,
  UserRecord,
  WorkerRecord,
} from './records';
import { isoAt, jsonValue } from './records';

export const USER_COLUMNS =
  'id, account_id, username, region, paused, worker_id, generation, lease_until, activity, checkpoint, application_version, last_action, last_error, inspection_requested_at, inspection, created_at, updated_at';

export class PopulationRepository {
  constructor(
    private readonly tx: SqlTx,
    private readonly ports: PopulationPorts
  ) {}

  async config(): Promise<PopulationConfig> {
    const rows = await this.tx.query(
      sql<ConfigurationRecord>`SELECT value, revision FROM population_config WHERE id = ${'default'} AND deleted_at IS NULL`
    );
    const row = rows[0];
    return row === undefined
      ? { ...DEFAULT_POPULATION_CONFIG }
      : populationConfigSchema.parse({
          ...populationConfigSchema.parse(jsonValue(row.value)),
          revision: row.revision,
        });
  }

  async initialize(): Promise<void> {
    const now = isoAt(this.ports.clock.now());
    await this.tx.run(
      sql`INSERT INTO population_config (id, created_at, updated_at, value, revision) VALUES (${'default'}, ${now}, ${now}, ${JSON.stringify(DEFAULT_POPULATION_CONFIG)}, 0) ON CONFLICT (id) DO NOTHING`
    );
  }

  async users(): Promise<UserRecord[]> {
    // Deliberately enumerate fields: credentials never enter an administrative response.
    return this.tx.query(
      sql<UserRecord>`SELECT id, account_id, username, region, paused, worker_id, generation, lease_until, activity, checkpoint, application_version, last_action, last_error, inspection_requested_at, inspection, created_at, updated_at FROM population_users WHERE deleted_at IS NULL ORDER BY username LIMIT 1000`
    );
  }

  async user(id: string): Promise<UserRecord | null> {
    const rows = await this.tx.query(
      sql<UserRecord>`SELECT id, account_id, username, region, paused, worker_id, generation, lease_until, activity, checkpoint, application_version, last_action, last_error, inspection_requested_at, inspection, created_at, updated_at FROM population_users WHERE id = ${id} AND deleted_at IS NULL`
    );
    return rows[0] ?? null;
  }

  async counts() {
    const now = isoAt(this.ports.clock.now());
    const rows = await this.tx.query(
      sql<{
        activity: string;
        region: string;
        count: number;
      }>`SELECT activity, region, COUNT(*) AS count FROM population_users WHERE worker_id IS NOT NULL AND lease_until > ${now} AND deleted_at IS NULL GROUP BY activity, region`
    );
    const count = (activity: string) =>
      rows
        .filter((row) => row.activity === activity)
        .reduce((sum, row) => sum + Number(row.count), 0);
    return {
      online: rows.reduce((sum, row) => sum + Number(row.count), 0),
      playing: count('playing'),
      matchmaking: count('matchmaking'),
      recovering: count('recovering'),
      groups: rows.map((row) => ({ ...row, count: Number(row.count) })),
    };
  }

  async workers(): Promise<WorkerRecord[]> {
    return this.tx.query(
      sql<WorkerRecord>`SELECT id, application_version, capacity, draining, heartbeat_at, memory_bytes, cpu_milliseconds, lease_failures FROM population_workers WHERE deleted_at IS NULL ORDER BY heartbeat_at DESC LIMIT 1000`
    );
  }

  async events(userId: string | null): Promise<EventRecord[]> {
    return userId === null
      ? this.tx.query(
          sql<EventRecord>`SELECT id, user_id, worker_id, generation, application_version, correlation_id, event, context, created_at FROM population_events WHERE deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 100`
        )
      : this.tx.query(
          sql<EventRecord>`SELECT id, user_id, worker_id, generation, application_version, correlation_id, event, context, created_at FROM population_events WHERE user_id = ${userId} AND deleted_at IS NULL ORDER BY created_at DESC, id DESC LIMIT 100`
        );
  }

  async event(input: {
    userId?: string;
    workerId?: string;
    generation?: number;
    version?: string;
    name: string;
    context?: Record<string, unknown>;
    correlationId?: string;
  }): Promise<void> {
    const now = isoAt(this.ports.clock.now());
    await this.tx.run(
      sql`INSERT INTO population_events (id, created_at, updated_at, user_id, worker_id, generation, application_version, correlation_id, event, context) VALUES (${this.ports.createId()}, ${now}, ${now}, ${input.userId ?? null}, ${input.workerId ?? null}, ${input.generation ?? 0}, ${input.version ?? null}, ${input.correlationId ?? input.userId ?? this.ports.createId()}, ${input.name}, ${JSON.stringify(input.context ?? {})})`
    );
  }
}

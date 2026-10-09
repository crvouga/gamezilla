import type {
  PopulationCommand,
  PopulationConfig,
} from '@libs/population-shared/config';
import type { SqlClient } from '@pkgs/sql-client-root-shared/interface';
import sql from '@pkgs/sql-root-shared/sql';
import { PopulationRepository } from './population-repository';
import type { PopulationPorts } from './records';
import { isoAt } from './records';

export class PopulationAdministration {
  constructor(
    private readonly db: SqlClient,
    private readonly ports: PopulationPorts
  ) {}

  async overview() {
    const repo = new PopulationRepository(this.db, this.ports);
    const [config, users, workers, events, counts] = await Promise.all([
      repo.config(),
      repo.users(),
      repo.workers(),
      repo.events(null),
      repo.counts(),
    ]);
    const now = this.ports.clock.now();
    return {
      config,
      users,
      workers,
      events,
      ...counts,
      observedAtMs: now,
    };
  }

  async configure(
    value: PopulationConfig,
    actorId: string
  ): Promise<PopulationConfig | null> {
    const result = await this.db.transaction(async (tx) => {
      const repo = new PopulationRepository(tx, this.ports);
      await repo.initialize();
      const now = isoAt(this.ports.clock.now());
      const rows = await tx.query(
        sql<{
          revision: number;
        }>`UPDATE population_config SET value = ${JSON.stringify(value)}, revision = revision + 1, updated_at = ${now} WHERE id = ${'default'} AND revision = ${value.revision} RETURNING revision`
      );
      const revision = rows[0]?.revision;
      if (revision === undefined) return null;
      await repo.event({
        name: 'PopulationConfigured',
        context: { actorId, desired: value.desired, revision },
      });
      return { ...value, revision };
    });
    if (result !== null) await this.ports.notify();
    return result;
  }

  async command(
    userId: string,
    value: PopulationCommand,
    actorId: string
  ): Promise<boolean> {
    const accepted = await this.db.transaction(async (tx) => {
      const now = isoAt(this.ports.clock.now());
      const user = await tx.query(
        sql<{
          id: string;
        }>`SELECT id FROM population_users WHERE id = ${userId} AND deleted_at IS NULL`
      );
      if (user.length === 0) return false;
      const rows = await tx.query(
        sql<{
          id: string;
        }>`INSERT INTO population_commands (id, created_at, updated_at, user_id, actor_id, command) VALUES (${value.operationId}, ${now}, ${now}, ${userId}, ${actorId}, ${value.command}) ON CONFLICT (id) DO NOTHING RETURNING id`
      );
      if (rows.length === 0) {
        const previous = await tx.query(
          sql<{
            user_id: string;
            command: string;
            actor_id: string;
          }>`SELECT user_id, command, actor_id FROM population_commands WHERE id = ${value.operationId}`
        );
        return (
          previous[0]?.user_id === userId &&
          previous[0]?.command === value.command &&
          previous[0]?.actor_id === actorId
        );
      }
      if (value.command === 'pause' || value.command === 'resume') {
        await tx.run(
          sql`UPDATE population_users SET paused = ${value.command === 'pause'}, updated_at = ${now} WHERE id = ${userId}`
        );
      }
      if (value.command === 'inspect')
        await tx.run(
          sql`UPDATE population_users SET inspection_requested_at = ${now}, updated_at = ${now} WHERE id = ${userId}`
        );
      await new PopulationRepository(tx, this.ports).event({
        userId,
        name: 'AdministrativeCommand',
        context: {
          actorId,
          command: value.command,
          operationId: value.operationId,
        },
      });
      return true;
    });
    if (accepted) await this.ports.notify();
    return accepted;
  }
}

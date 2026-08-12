import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';

import type { MatchmakingSchema } from '../interface/schema';
import type { RadiusOptions } from '../interface/types';
import { type MigrateTuning, migrate } from './migrate';

export type MatchmakingDatabaseMigrationArgs = {
  readonly schema?: MatchmakingSchema;
  readonly radius?: RadiusOptions;
  readonly tuning?: MigrateTuning;
};

/** Applies matchmaking Postgres schema (waiting partitions, tick functions, …). */
export class MatchmakingDatabaseMigration implements DatabaseMigration {
  private readonly schema: MatchmakingSchema | undefined;
  private readonly radius: RadiusOptions | undefined;
  private readonly tuning: MigrateTuning | undefined;

  constructor(args: MatchmakingDatabaseMigrationArgs = {}) {
    this.schema = args.schema;
    this.radius = args.radius;
    this.tuning = args.tuning;
  }

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    await migrate({
      sqlClient: ctx.sqlClient,
      ...(this.schema !== undefined ? { schema: this.schema } : {}),
      ...(this.radius !== undefined ? { radius: this.radius } : {}),
      ...(this.tuning !== undefined ? { tuning: this.tuning } : {}),
    });
  }
}

import type {
  DatabaseMigration,
  DatabaseMigrationContext,
} from '@pkgs/db-migrate';
import type { Pool } from 'pg';

import {
  type RunBetterAuthMigrationsArgs,
  runBetterAuthMigrations,
} from './run-better-auth-migrations';

/**
 * Applies Better Auth Kysely DDL via its own pool connection (must not share
 * an open domain migrate transaction).
 */
export class BetterAuthDatabaseMigration implements DatabaseMigration {
  private readonly args: RunBetterAuthMigrationsArgs;

  constructor(args: {
    readonly database: Pool;
    readonly secret: string;
    readonly baseURL: string;
  }) {
    this.args = args;
  }

  async migrate(ctx: DatabaseMigrationContext): Promise<void> {
    ctx.logger.info('applying Better Auth schema');
    await runBetterAuthMigrations(this.args);
    ctx.logger.info('Better Auth schema applied');
  }
}

export { BetterAuthDatabaseMigration } from './better-auth-database-migration';
export {
  BETTER_AUTH_TABLE_NAMES,
  type BetterAuthTableName,
} from './better-auth-table-names';
export {
  type BetterAuthDatabase,
  type BetterAuthInstance,
  type CreateBetterAuthConfig,
  createBetterAuth,
} from './create-better-auth';
export {
  BETTER_AUTH_PROVIDER_LABEL,
  createBetterAuthServerAdapter,
} from './create-better-auth-server-adapter';
export { type MintE2eSessionResult, mintE2eSession } from './mint-e2e-session';
export {
  type RunBetterAuthMigrationsArgs,
  runBetterAuthMigrations,
} from './run-better-auth-migrations';
export {
  SqlClientSqliteDialect,
  type SqlClientSqliteDialectConfig,
} from './sql-client-sqlite-dialect';
export { buildBetterAuthTrustedOrigins } from './trusted-origins';

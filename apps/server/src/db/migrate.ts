// @api-wall-ok
/** Re-export — migrate orchestration lives in `@libs/db`. */
export {
  migratePostgresApp,
  type MigratePostgresAppOptions,
} from '@libs/db/server/migrate';

// @api-wall-ok
/** Re-export — migrate orchestration lives in `@libs/db`. */
export {
  type MigratePostgresAppOptions,
  migratePostgresApp,
} from '@libs/db/server/migrate';

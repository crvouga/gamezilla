import { AUTH_TABLES } from '@libs/auth/public/schema';
import { BILLING_TABLES } from '@libs/billing/public/schema';
import { CHESS_TABLES } from '@libs/chess/public/schema';
import { CLIENT_CONFIG_TABLES } from '@libs/client-config/public/schema';
import { FRIENDS_TABLES } from '@libs/friends/public/schema';
import { NOTIFICATIONS_TABLES } from '@libs/notifications/public/schema';
import { PROFILE_TABLES } from '@libs/profile/public/schema';
import { SPACES_TABLES } from '@libs/spaces/public/schema';
import { domainsFromTables, registerTables } from '@pkgs/db-schema';

const ALL_TABLES = [
  ...AUTH_TABLES,
  ...PROFILE_TABLES,
  ...SPACES_TABLES,
  ...FRIENDS_TABLES,
  ...CHESS_TABLES,
  ...CLIENT_CONFIG_TABLES,
  ...NOTIFICATIONS_TABLES,
  ...BILLING_TABLES,
] as const;

/** Registered domain ids for composed app schema tables. */
export const APP_SCHEMA_DOMAINS = domainsFromTables(ALL_TABLES);

/** Declarative domain schema for Postgres + local SQLite. */
export const appSchema = registerTables(ALL_TABLES);

/** Domain table names present on the local SQLite client (CACHE). */
export const LOCAL_DOMAIN_TABLE_NAMES = Object.keys(
  appSchema.snapshot().tables
).sort() as readonly string[];

import {
  ALL_INBOX_LOCAL_DDL,
  ALL_INBOX_SYNC_TABLES,
} from '@pkgs/inbox/sync/table-defs';

import { AUTH_LOCAL_DDL, AUTH_TABLE_NAMES } from './auth-tables';
import { ALL_CHESS_LOCAL_DDL, ALL_CHESS_SYNC_TABLES } from './chess-tables';
import {
  ALL_CLIENT_CONFIG_LOCAL_DDL,
  ALL_CLIENT_CONFIG_SYNC_TABLES,
} from './client-config-tables';
import {
  ALL_FRIENDS_LOCAL_DDL,
  ALL_FRIENDS_SYNC_TABLES,
} from './friends-tables';
import {
  ALL_PROFILE_LOCAL_DDL,
  ALL_PROFILE_SYNC_TABLES,
} from './profile-tables';
import { ALL_SPACE_LOCAL_DDL, ALL_SPACE_SYNC_TABLES } from './space-tables';

/** Domain table names present on the local SQLite client (CACHE). */
export const LOCAL_DOMAIN_TABLE_NAMES = [
  ...AUTH_TABLE_NAMES,
  ...ALL_PROFILE_SYNC_TABLES,
  ...ALL_SPACE_SYNC_TABLES,
  ...ALL_CHESS_SYNC_TABLES,
  ...ALL_CLIENT_CONFIG_SYNC_TABLES,
  ...ALL_FRIENDS_SYNC_TABLES,
  ...ALL_INBOX_SYNC_TABLES,
] as const;

/** Raw SQLite DDL for domain tables (applied by sync-engine migrate). */
export const LOCAL_DOMAIN_DDL = [
  ...AUTH_LOCAL_DDL,
  ...ALL_PROFILE_LOCAL_DDL,
  ...ALL_SPACE_LOCAL_DDL,
  ...ALL_CHESS_LOCAL_DDL,
  ...ALL_CLIENT_CONFIG_LOCAL_DDL,
  ...ALL_FRIENDS_LOCAL_DDL,
  ...ALL_INBOX_LOCAL_DDL,
] as const;

/** @deprecated Prefer LOCAL_DOMAIN_TABLE_NAMES / LOCAL_DOMAIN_DDL. */
export const SYNC_TABLE_REGISTRY = {
  tableNames: () => LOCAL_DOMAIN_TABLE_NAMES,
};

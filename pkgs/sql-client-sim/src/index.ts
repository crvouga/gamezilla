/**
 * Harness-only DST surface for multi-tab web SQL. Tests and sim consoles only —
 * product code must never import this (it would pull `@pkgs/sim` in).
 */
export { startStore, startTab } from './nodes';
export {
  connectTab,
  disconnectTab,
  ensureOwnerClient,
  killTab,
  ownerTabId,
} from './ownership';
export {
  ownerId,
  ownerRows,
  SQL_CLIENT_WEB_ARGS,
  type SqlClientWebArgs,
  sqlClientWeb,
  tabIdList,
} from './system';
export { migrateToyKv, readToyRows, VERSION_STRIDE } from './toy-kv';
export {
  createSqlClientWebState,
  SIM_DB_NAME,
  type SqlClientWebBackend,
  type SqlClientWebState,
  type SqlClientWebSurface,
} from './types';

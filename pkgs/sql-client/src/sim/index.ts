/**
 * Harness-only DST surface for multi-tab web SQL. Tests and sim consoles only —
 * product code must never import this (it would pull `@pkgs/determinism` in).
 */
export { SQL_CLIENT_WEB_ACTIONS } from './actions';
export { sqlWebStoreNode, sqlWebTabNode } from './nodes';
export {
  connectTab,
  disconnectTab,
  ensureOwnerClient,
  killTab,
  ownerTabId,
} from './ownership';
export {
  defineSqlClientWebSystem,
  SQL_CLIENT_WEB_SYSTEM,
  type SqlClientWebSystemDef,
  type SqlClientWebWorld,
} from './system';
export { migrateToyKv, readToyRows, VERSION_STRIDE } from './toy-kv';
export {
  createSqlClientWebState,
  SIM_DB_NAME,
  type SqlClientWebBackend,
  type SqlClientWebState,
} from './types';

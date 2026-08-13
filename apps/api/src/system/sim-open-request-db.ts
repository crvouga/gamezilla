/**
 * Attach {@link OpenRequestDb} onto a sim {@link SqlClient} so `api.implement`
 * can resolve it from graph deps without an address registry.
 */

import type { SqlClient } from '@pkgs/sql-client/interface';

import type { OpenRequestDb } from '../db/open-request-db';

export const SIM_OPEN_REQUEST_DB = Symbol.for('gamezilla.simOpenRequestDb');

export function attachSimOpenRequestDb(
  sqlClient: SqlClient,
  openRequestDb: OpenRequestDb
): SqlClient {
  Object.defineProperty(sqlClient, SIM_OPEN_REQUEST_DB, {
    value: openRequestDb,
    enumerable: false,
    configurable: true,
  });
  return sqlClient;
}

export function requireSimOpenRequestDb(sqlClient: SqlClient): OpenRequestDb {
  const open = (
    sqlClient as SqlClient & {
      readonly [SIM_OPEN_REQUEST_DB]?: OpenRequestDb;
    }
  )[SIM_OPEN_REQUEST_DB];
  if (open === undefined) {
    throw new Error(
      'api.implement: SqlClient missing sim OpenRequestDb — attach via product provide'
    );
  }
  return open;
}

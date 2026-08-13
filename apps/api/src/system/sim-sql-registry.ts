/**
 * Registers a product sim SQLite handle so {@link apiResource} can build
 * {@link createSimApiApp} from graph deps (deps may be Proxies — key by address).
 */

import type { Database as BetterSqliteDatabase } from 'better-sqlite3';
import type { OpenRequestDb } from '../db/open-request-db';

export type SimSqlBinding = {
  readonly sqlite: BetterSqliteDatabase;
  readonly openRequestDb: OpenRequestDb;
};

const byAddress = new Map<string, SimSqlBinding>();

export function registerSimSqlClient(
  address: string,
  binding: SimSqlBinding
): void {
  byAddress.set(address, binding);
}

export function lookupSimSqlClient(address = 'db'): SimSqlBinding {
  const hit = byAddress.get(address);
  if (!hit) {
    throw new Error(
      `api.implement: no sim SQLite registered for '${address}' — call registerSimSqlClient from the DST provide/boot path`
    );
  }
  return hit;
}

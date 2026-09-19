/**
 * Who an actor is, outside the app: their Google address, and the product
 * account and username the server gave them. Everything here reads the
 * server, so it answers the same at every fidelity — including a localhost
 * stack, where each actor's own database lives inside their browser.
 */
import { sql } from '@pkgs/sql';
import type { SqlTx } from '@pkgs/sql-client/interface';

import { simIdpEmail } from '../fabric/sim-idp';
import { type ProductSim, productExtra } from './sim';

/** The Google address the person behind `actorId` signs in with. */
export function actorEmail(s: ProductSim, actorId: string): string {
  const http = productExtra(s).http;
  return http.kind === 'stack'
    ? simIdpEmail(`${actorId}.${http.accountTag}`)
    : simIdpEmail(actorId);
}

/** The actor's product account id, or `null` before they have signed in. */
export async function accountIdOf(
  s: ProductSim,
  actorId: string
): Promise<string | null> {
  const rows = await s.sim.serverSql.sqlClient.query(sql<{
    readonly user_id: string;
  }>`
    SELECT a.user_id
    FROM auth_external_accounts a
    JOIN idp_users u ON u.id = a.external_id
    WHERE a.provider = 'idp'
      AND u.email = ${actorEmail(s, actorId)}
      AND a.deleted_at IS NULL
    LIMIT 1`);
  return rows[0]?.user_id ?? null;
}

/**
 * The actor's local database (their synced copy), wherever the actor runs,
 * or `null` before the app has opened one.
 */
export function actorLocalSql(s: ProductSim, actorId: string): SqlTx | null {
  const actor = s.actors.get(actorId);
  if (actor !== undefined) return actor.localSql();
  return s.sim.clientSql(actorId)?.sqlClient ?? null;
}

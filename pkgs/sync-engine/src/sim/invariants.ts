import { sql } from '@pkgs/sql';
import type { SqlClient } from '@pkgs/sql-client/interface';

import type { TigerInvariant } from '../queries/shared/tiger-invariants';
import { readServerNotes } from './server';

export type InvariantViolation = {
  readonly invariant: TigerInvariant | 'convergence';
  readonly detail: string;
};

/** Pending mutation seqs must be strictly increasing per client. */
export async function checkSeqMonotonicity(
  db: SqlClient
): Promise<InvariantViolation | null> {
  const rows = await db.query(sql<{
    client_id: string;
    seq: number;
  }>`
    SELECT client_id, seq FROM _mutations ORDER BY client_id ASC, seq ASC
  `);
  let lastClient = '';
  let lastSeq = -1;
  for (const row of rows) {
    if (row.client_id !== lastClient) {
      lastClient = row.client_id;
      lastSeq = row.seq;
      continue;
    }
    if (row.seq <= lastSeq) {
      return {
        invariant: 'seq-monotonicity',
        detail: `client=${row.client_id} seq ${row.seq} <= ${lastSeq}`,
      };
    }
    lastSeq = row.seq;
  }
  return null;
}

export async function checkClientNotesMatchServer(args: {
  readonly clientDb: SqlClient;
  readonly serverDb: SqlClient;
  readonly clientLabel: string;
}): Promise<InvariantViolation | null> {
  const server = await readServerNotes(args.serverDb);
  const local = await args.clientDb.query(sql<{
    id: string;
    body: string;
    owner_id: string;
  }>`
    SELECT id, body, owner_id FROM notes ORDER BY id ASC
  `);
  const serverKey = JSON.stringify(server);
  const localKey = JSON.stringify(local);
  if (serverKey !== localKey) {
    return {
      invariant: 'convergence',
      detail: `${args.clientLabel} notes diverge from server local=${localKey} server=${serverKey}`,
    };
  }
  return null;
}

export async function checkAllClientsConverged(args: {
  readonly clients: readonly {
    readonly label: string;
    readonly db: SqlClient;
  }[];
  readonly serverDb: SqlClient;
}): Promise<InvariantViolation | null> {
  for (const client of args.clients) {
    const v = await checkClientNotesMatchServer({
      clientDb: client.db,
      serverDb: args.serverDb,
      clientLabel: client.label,
    });
    if (v !== null) return v;
  }
  return null;
}

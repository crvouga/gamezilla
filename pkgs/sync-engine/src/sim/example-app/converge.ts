import type { SqlClient } from '@pkgs/sql-client/interface';

import type { InvariantViolation } from '../invariants';
import {
  type LiveFolder,
  type LiveNote,
  readLiveFolders,
  readLiveNotes,
} from './assert';

function domainKey(
  notes: readonly LiveNote[],
  folders: readonly LiveFolder[]
): string {
  return JSON.stringify({ notes, folders });
}

export async function checkClientDomainMatchServer(args: {
  readonly clientDb: SqlClient;
  readonly serverDb: SqlClient;
  readonly clientLabel: string;
}): Promise<InvariantViolation | null> {
  const serverNotes = await readLiveNotes(args.serverDb);
  const serverFolders = await readLiveFolders(args.serverDb);
  const localNotes = await readLiveNotes(args.clientDb);
  const localFolders = await readLiveFolders(args.clientDb);
  const serverKey = domainKey(serverNotes, serverFolders);
  const localKey = domainKey(localNotes, localFolders);
  if (serverKey !== localKey) {
    return {
      invariant: 'convergence',
      detail: `${args.clientLabel} domain diverges from server local=${localKey} server=${serverKey}`,
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
    const v = await checkClientDomainMatchServer({
      clientDb: client.db,
      serverDb: args.serverDb,
      clientLabel: client.label,
    });
    if (v !== null) return v;
  }
  return null;
}

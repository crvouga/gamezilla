import { unsafe } from '@pkgs/sql';

import type { BootedSimKernel } from './world-types';

export type LocalStorageTamper = 'corruptCheckpoint' | 'flipDomainRow';

/** Tamper a client's preserved local SQLite (live or last crash bundle). */
export async function tamperClientLocalStorage(
  k: BootedSimKernel,
  clientId: string,
  tamper: LocalStorageTamper
): Promise<void> {
  const handle = k.clients.get(clientId);
  const db =
    handle?.db ??
    k.metas.get(clientId)?.lastDbBundle?.serial ??
    k.metas.get(clientId)?.lastDbBundle?.raw;
  if (db === undefined) {
    throw new Error(`no local db to tamper for client ${clientId}`);
  }
  switch (tamper) {
    case 'corruptCheckpoint':
      await db.run(unsafe(`DELETE FROM sync_engine_scope_meta`));
      break;
    case 'flipDomainRow':
      await db.run(
        unsafe(
          `UPDATE notes SET body = 'sim-tampered' WHERE deleted_at IS NULL LIMIT 1`
        )
      );
      break;
    default: {
      const _exhaustive: never = tamper;
      throw new Error(String(_exhaustive));
    }
  }
}

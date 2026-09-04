import { unsafe } from '@pkgs/sql';

import type { BootedSimKernel } from './kit-types';

export type LocalStorageTamper =
  | 'corruptCheckpoint'
  | 'flipDomainRow'
  | 'corruptQueuedArgs'
  | 'corruptLastHash';

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
      await db.run(
        unsafe(
          `UPDATE sync_engine_scope_meta SET deleted_at = '1970-01-01T00:00:00.000Z' WHERE deleted_at IS NULL`
        )
      );
      break;
    case 'flipDomainRow': {
      const flip = k.domain.tamperDomainRow;
      if (flip === undefined) {
        throw new Error('flipDomainRow requires SimDomainPack.tamperDomainRow');
      }
      await flip(db);
      break;
    }
    case 'corruptQueuedArgs':
      await db.run(
        unsafe(
          `UPDATE sync_engine_mutations SET args = '__not_json__' WHERE deleted_at IS NULL AND id IN (SELECT id FROM sync_engine_mutations WHERE deleted_at IS NULL LIMIT 1)`
        )
      );
      break;
    case 'corruptLastHash':
      await db.run(
        unsafe(
          `UPDATE sync_engine_scope_meta SET last_hash = '__sim_corrupt_hash__' WHERE deleted_at IS NULL`
        )
      );
      break;
    default: {
      const _exhaustive: never = tamper;
      throw new Error(String(_exhaustive));
    }
  }
}

import { accountMutationEnv } from '@libs/auth/public/account-mutation-env';
import type { AccountPrivacyContribution } from '@libs/feature/public/account-privacy';
import type { Clock } from '@pkgs/clock';
import { sql } from '@pkgs/sql';
import type { SqlClient, SqlTx } from '@pkgs/sql-client/interface';
import { wrapMutationDb } from '@pkgs/sync-engine/server';
import type { CreateId } from '@pkgs/uuid';
import type { RoomServicePort } from '@pkgs/room/server';

/** A recovery runs with writes paused and keeps the live deletion journal. */
export class RecoverAccountData {
  constructor(
    private readonly db: SqlClient,
    private readonly ports: {
      readonly rooms: RoomServicePort;
      readonly clock: Clock;
      readonly createId: CreateId;
      readonly contributions: readonly AccountPrivacyContribution[];
    }
  ) {}
  async execute(restore: (tx: SqlTx) => Promise<void>): Promise<void> {
    await this.db.transaction(async (tx) => {
      const receipts = await tx.query(
        sql<{
          owner_id: string;
          erase_by: string;
        }>`SELECT owner_id, erase_by FROM profile_deletion_receipts WHERE deleted_at IS NULL`
      );
      await restore(tx);
      for (const receipt of receipts) {
        const context = accountMutationEnv(receipt.owner_id, this.ports);
        const managed = wrapMutationDb(tx, context);
        for (const contribution of this.ports.contributions) {
          await contribution.withdraw({ tx: managed.tx, env: context });
          if (Date.parse(String(receipt.erase_by)) <= this.ports.clock.now())
            await contribution.erase(
              { tx: managed.tx, env: context },
              this.ports.rooms
            );
        }
      }
    });
  }
}

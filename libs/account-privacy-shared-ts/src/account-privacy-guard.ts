import type { AccountPrivacyGuard } from '@libs/sub-shared-ts/account-privacy';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { MutationError } from '@pkgs/sync-engine-shared-ts/mutations-types';

/** Withdrawal shares the mutation transaction and its captured wake topics. */
export const accountPrivacyGuard: AccountPrivacyGuard =
  (contributions) => async (ctx) => {
    const deleted = await ctx.tx.query(
      sql<
        Record<string, unknown>
      >`SELECT deletion_at FROM profile_account_privacy WHERE owner_id = ${ctx.env.actorId}`
    );
    if (deleted[0]?.['deletion_at'] != null)
      throw new MutationError(
        'account_deleted',
        'This account was deleted. Sign in again to start a new account.'
      );
    if (ctx.name !== 'confirmAccountDeletion') return;
    for (const contribution of contributions) await contribution.withdraw(ctx);
  };

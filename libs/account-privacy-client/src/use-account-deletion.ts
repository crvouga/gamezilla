import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { useSignOut } from '@libs/auth-client/use-sign-out';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import type { Decision } from '@pkgs/permissions-shared/decision';
import { usePermissions } from '@libs/permissions-client/use-permissions';
import sql from '@pkgs/sql-shared/sql';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { createMemo, createSignal } from 'solid-js';
import { confirmAccountDeletionMutation } from '@libs/account-privacy-shared/confirm-account-deletion-mutation';

export function useAccountDeletion() {
  const permissions = usePermissions();
  const client = useMutationClient();
  const signOut = useSignOut();
  const receipts = createQuery(
    () =>
      sql<{
        erase_by: string;
        cancellation_status: string | null;
      }>`SELECT erase_by, cancellation_status FROM profile_deletion_receipts ORDER BY confirmed_at DESC LIMIT 1`
  );
  const receipt = createMemo(() => receipts.rows()[0]?.erase_by ?? null);
  const [confirming, setConfirming] = createSignal(false);
  const [denial, setDenial] = createSignal<Decision | null>(null);
  const allowed = () => {
    const decision = permissions.can(PERMISSION.profileDeleteAccount);
    setDenial(decision.allowed ? null : decision);
    return decision.allowed;
  };
  return {
    cancellationStatus: () =>
      receipts.rows()[0]?.cancellation_status ?? 'pending',
    receipt,
    confirming,
    denial,
    review: () => {
      if (allowed()) setConfirming(true);
    },
    cancel: () => setConfirming(false),
    confirm: async () => {
      if (!allowed())
        throw new Error('Account deletion needs the permission shown below.');
      const result = await client.mutate(confirmAccountDeletionMutation, {
        confirmed: true,
      });
      if (!result.ok)
        throw new Error(
          result.failures[0]?.message ?? 'Account deletion failed.'
        );
      await signOut();
    },
  };
}

import { useMutationClient } from '@libs/auth/public/use-mutation-client';
import { useSignOut } from '@libs/auth/public/use-sign-out';
import { PERMISSION } from '@libs/permissions/public/permission-catalog';
import { usePermissions, type Decision } from '@libs/permissions/public/use-permissions';
import { sql } from '@pkgs/sql';
import { createQuery } from '@pkgs/sync-engine/solid';
import { createMemo, createSignal } from 'solid-js';
import { confirmAccountDeletionMutation } from '../shared/confirm-account-deletion-mutation';

export function useAccountDeletion() {
  const permissions = usePermissions();
  const client = useMutationClient();
  const signOut = useSignOut();
  const receipts = createQuery(() => sql<{erase_by: string}>`SELECT erase_by FROM profile_account_privacy WHERE deletion_at IS NOT NULL ORDER BY deletion_at DESC LIMIT 1`);
  const receipt = createMemo(() => receipts.rows()[0]?.erase_by ?? null);
  const [confirming, setConfirming] = createSignal(false);
  const [denial, setDenial] = createSignal<Decision | null>(null);
  const allowed = () => {
    const decision = permissions.can(PERMISSION.profileDeleteAccount);
    setDenial(decision.allowed ? null : decision);
    return decision.allowed;
  };
  return {
    receipt,
    confirming,
    denial,
    review: () => { if (allowed()) setConfirming(true); },
    cancel: () => setConfirming(false),
    confirm: async () => {
      if (!allowed()) throw new Error('Account deletion needs the permission shown below.');
      const result = await client.mutate(confirmAccountDeletionMutation, { confirmed: true });
      if (!result.ok) throw new Error(result.failures[0]?.message ?? 'Account deletion failed.');
      await signOut();
    },
  };
}

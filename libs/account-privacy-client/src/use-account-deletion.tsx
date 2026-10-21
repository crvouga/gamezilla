import { confirmAccountDeletionMutation } from '@libs/account-privacy-shared/confirm-account-deletion-mutation';
import { useSignOut } from '@libs/auth-client/use-sign-out';
import { usePermissions } from '@libs/permissions-client/use-permissions';
import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { useLingui } from '@lingui/solid/macro';
import type { Decision } from '@pkgs/permissions-shared/decision';
import sql from '@pkgs/sql-root-shared/sql';
import { useMutationClient } from '@pkgs/sync-engine-client/mutation-client-context';
import { createQuery } from '@pkgs/sync-engine-client/sync-engine-context';
import { createMemo, createSignal } from 'solid-js';
import { privacyDenial } from './privacy-denial';

export function useAccountDeletion() {
  const { t } = useLingui();
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
  /**
   * A refusal's way forward is the notice on the screen, so the confirmation
   * closes to show it rather than hide it behind the dialog.
   */
  const refuse = (decision: Decision): never => {
    setDenial(decision);
    setConfirming(false);
    throw new Error(
      t`Account deletion was not confirmed. Nothing was deleted.`
    );
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
      const decision = permissions.can(PERMISSION.profileDeleteAccount);
      if (!decision.allowed) refuse(decision);
      setDenial(null);
      const result = await client.mutate(confirmAccountDeletionMutation, {
        confirmed: true,
      });
      if (!result.ok) {
        const failure = result.failures[0];
        const refused = privacyDenial(failure, PERMISSION.profileDeleteAccount);
        if (refused !== null) refuse(refused);
        throw new Error(
          failure?.code === 'account_deleted'
            ? t`This account was already deleted. Sign in again to start a new account.`
            : t`Account deletion did not go through. Nothing was deleted. Try again.`
        );
      }
      await signOut();
    },
  };
}

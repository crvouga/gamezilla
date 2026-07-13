import { Box, Button, useMutationButton } from '@pkgs/ui';
import type { SoundId } from '@pkgs/sounds';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export function ConfirmDeletePills({
  onConfirm,
  onDelete,
}: {
  onConfirm: () => Promise<void>;
  onDelete: () => Promise<void>;
}): ReactNode {
  const { t } = useLingui();
  const confirm = useMutationButton({
    operation: onConfirm,
    labels: {
      idle: <Trans>Confirm</Trans>,
      loading: t`Confirming…`,
      success: t`Confirmed`,
      error: t`Couldn't confirm`,
    },
    successHoldMs: 0,
  });
  const del = useMutationButton({
    operation: onDelete,
    labels: {
      idle: <Trans>Delete</Trans>,
      loading: t`Deleting…`,
      success: t`Deleted`,
      error: t`Couldn't delete`,
    },
    successHoldMs: 0,
  });
  return (
    <Box sx={{ flexDirection: 'row', gap: 2, alignSelf: 'stretch' }}>
      <Box sx={{ flex: 1 }}>
        <Button variant="solid" {...confirm.buttonProps} />
      </Box>
      <Box sx={{ flex: 1 }}>
        <Button variant="outline" {...del.buttonProps} />
      </Box>
    </Box>
  );
}

export function SingleActionPill({
  operation,
  idle,
  loading,
  success,
  error,
  variant = 'solid',
  disabled = false,
  sounds,
}: {
  operation: () => Promise<void>;
  idle: ReactNode;
  loading: string;
  success: string;
  error: string;
  variant?: 'solid' | 'outline';
  disabled?: boolean;
  sounds?: { success?: SoundId; error?: SoundId };
}): ReactNode {
  const mutation = useMutationButton({
    operation,
    labels: { idle, loading, success, error },
    successHoldMs: 0,
    disabled,
    sounds,
  });
  return <Button variant={variant} {...mutation.buttonProps} />;
}

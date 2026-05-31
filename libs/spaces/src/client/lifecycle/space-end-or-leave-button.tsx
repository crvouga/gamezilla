import { useSpaceActions } from './space-actions';
import { EndSpaceConfirmModal } from './end-space-confirm-modal';
import { LeaveSpaceConfirmModal } from './leave-space-confirm-modal';
import { useCurrentSpaceRole } from '../use-current-space-role';
import { borderRadius, Pressable, Text } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useState, type ReactNode } from 'react';

export type SpaceEndOrLeaveButtonProps = {
  spaceId: string;
};

/**
 * Single button that ends or leaves a space depending on the current user's
 * role. Owns its confirm modal state and dispatches `endSpace` / `leaveSpace`.
 */
export function SpaceEndOrLeaveButton({
  spaceId,
}: SpaceEndOrLeaveButtonProps): ReactNode {
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';
  const { t } = useLingui();
  const { endSpace, leaveSpace } = useSpaceActions();
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  return (
    <>
      <Pressable
        onPress={() => (isHost ? setConfirmEnd(true) : setConfirmLeave(true))}
        accessibilityRole="button"
        accessibilityLabel={isHost ? t`End space` : t`Leave space`}
        sx={{
          py: 2,
          px: 4,
          borderRadius: borderRadius.full,
          backgroundColor: 'onTintScrim',
        }}
      >
        <Text
          variant="caption"
          sx={{ color: 'onTint', fontWeight: '600' }}
          label={isHost ? <Trans>End</Trans> : <Trans>Leave</Trans>}
        />
      </Pressable>
      <EndSpaceConfirmModal
        visible={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        operation={() => endSpace(spaceId)}
      />
      <LeaveSpaceConfirmModal
        visible={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        operation={() => leaveSpace(spaceId)}
      />
    </>
  );
}

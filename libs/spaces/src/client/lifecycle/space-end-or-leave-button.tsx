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

/* eslint-disable lingui/no-unlocalized-strings -- color tokens, not user-facing copy */
const ACTION_BG = 'rgba(255,255,255,0.22)';
const ACTION_BG_DESTRUCTIVE = 'rgba(0,0,0,0.28)';
const ACTION_TEXT = '#FFFFFF';
/* eslint-enable lingui/no-unlocalized-strings */

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
          backgroundColor: isHost ? ACTION_BG_DESTRUCTIVE : ACTION_BG,
        }}
      >
        <Text
          variant="caption"
          sx={{ color: ACTION_TEXT, fontWeight: '600' }}
          label={isHost ? <Trans>End</Trans> : <Trans>Leave</Trans>}
        />
      </Pressable>
      <EndSpaceConfirmModal
        visible={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={() => {
          setConfirmEnd(false);
          void endSpace(spaceId);
        }}
      />
      <LeaveSpaceConfirmModal
        visible={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        onConfirm={() => {
          setConfirmLeave(false);
          void leaveSpace(spaceId);
        }}
      />
    </>
  );
}

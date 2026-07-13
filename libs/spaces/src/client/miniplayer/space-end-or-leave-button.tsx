import { useRequestEndSpace } from '../end-space/end-space-modal-provider';
import { useRequestLeaveSpace } from '../leave-space/leave-space-modal-provider';
import { useCurrentSpaceRole } from '../use-current-space-role';
import { borderRadius, Pressable, Text } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

export type SpaceEndOrLeaveButtonProps = {
  spaceId: string;
};

/**
 * Miniplayer control: ends as host or leaves as guest. Each action uses its
 * own slice modal provider so confirms stay mounted through membership blips.
 */
export function SpaceEndOrLeaveButton({
  spaceId,
}: SpaceEndOrLeaveButtonProps): ReactNode {
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';
  const { t } = useLingui();
  const requestEndSpace = useRequestEndSpace();
  const requestLeaveSpace = useRequestLeaveSpace();
  const onPress = useCallback(() => {
    if (isHost) {
      requestEndSpace(spaceId);
      return;
    }
    requestLeaveSpace(spaceId);
  }, [isHost, requestEndSpace, requestLeaveSpace, spaceId]);

  return (
    <Pressable
      onPress={onPress}
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
  );
}

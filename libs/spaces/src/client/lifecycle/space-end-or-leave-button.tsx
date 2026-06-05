import { useSpaceLifecycleModals } from './space-lifecycle-modal-provider';
import { useCurrentSpaceRole } from '../use-current-space-role';
import { borderRadius, Pressable, Text } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import { useCallback, type ReactNode } from 'react';

export type SpaceEndOrLeaveButtonProps = {
  spaceId: string;
};

/**
 * Single button that ends or leaves a space depending on the current user's
 * role. Dispatches through {@link SpaceLifecycleModalProvider} so the confirm
 * modal stays mounted through loading → success when the miniplayer card drops.
 */
export function SpaceEndOrLeaveButton({
  spaceId,
}: SpaceEndOrLeaveButtonProps): ReactNode {
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';
  const { t } = useLingui();
  const { requestEndSpace, requestLeaveSpace } = useSpaceLifecycleModals();
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

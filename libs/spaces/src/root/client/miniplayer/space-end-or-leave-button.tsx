import { Trans, useLingui } from '@lingui/react/macro';
import { borderRadius, Pressable, Text } from '@pkgs/ui-rn';
import { type ReactNode, useCallback } from 'react';
import type { RequestEndSpaceOptions } from '../end-space/end-space-modal-provider';
import type { RequestLeaveSpaceOptions } from '../leave-space/leave-space-modal-provider';
import { useCurrentSpaceRole } from '../use-current-space-role';

export type SpaceEndOrLeaveButtonProps = {
  spaceId: string;
  /** Injected so this button can render inside portaled sheets. */
  requestEndSpace: (spaceId: string, options?: RequestEndSpaceOptions) => void;
  /** Injected so this button can render inside portaled sheets. */
  requestLeaveSpace: (
    spaceId: string,
    options?: RequestLeaveSpaceOptions
  ) => void;
};

/**
 * Miniplayer control: ends as host or leaves as guest. Requestors are injected
 * from above portal boundaries (`@gorhom/bottom-sheet` loses React context).
 */
export function SpaceEndOrLeaveButton({
  spaceId,
  requestEndSpace,
  requestLeaveSpace,
}: SpaceEndOrLeaveButtonProps): ReactNode {
  const role = useCurrentSpaceRole(spaceId);
  const isHost = role === 'host';
  const { t } = useLingui();
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
        sx={{ color: 'onPrimary', fontWeight: '600' }}
        label={isHost ? <Trans>End</Trans> : <Trans>Leave</Trans>}
      />
    </Pressable>
  );
}

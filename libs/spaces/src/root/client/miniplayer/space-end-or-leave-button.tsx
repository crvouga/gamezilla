import { Trans, useLingui } from '@lingui/solid/macro';
import { borderRadius, Clickable, Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';
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
export function SpaceEndOrLeaveButton(
  props: SpaceEndOrLeaveButtonProps
): JSX.Element {
  const role = useCurrentSpaceRole(props.spaceId);
  const isHost = createMemo(() => role() === 'host');
  const { t } = useLingui();
  const onPress = (): void => {
    if (isHost()) {
      props.requestEndSpace(props.spaceId);
      return;
    }
    props.requestLeaveSpace(props.spaceId);
  };

  return (
    <Clickable
      onClick={onPress}
      role="button"
      aria-label={isHost() ? t`End space` : t`Leave space`}
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
        label={
          <Show when={isHost()} fallback={<Trans>Leave</Trans>}>
            <Trans>End</Trans>
          </Show>
        }
      />
    </Clickable>
  );
}

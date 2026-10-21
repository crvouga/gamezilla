import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client/button';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import type { RequestEndSpaceOptions } from './end-space-modal-provider';
import type { RequestLeaveSpaceOptions } from './leave-space-modal-provider';
import { useSpaceCan } from './use-space-can';

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
 * from above portal boundaries (portals lose context).
 */
export function SpaceEndOrLeaveButton(
  props: SpaceEndOrLeaveButtonProps
): JSX.Element {
  const canEndSpace = useSpaceCan(() => props.spaceId, PERMISSION.spacesEnd);
  const { t } = useLingui();
  const onPress = (): void => {
    if (canEndSpace()) {
      props.requestEndSpace(props.spaceId);
      return;
    }
    props.requestLeaveSpace(props.spaceId);
  };

  return (
    <Button
      size="sm"
      intent="neutral"
      onClick={onPress}
      aria-label={canEndSpace() ? t`End space` : t`Leave space`}
      title={
        <Show when={canEndSpace()} fallback={<Trans>Leave</Trans>}>
          <Trans>End</Trans>
        </Show>
      }
    />
  );
}

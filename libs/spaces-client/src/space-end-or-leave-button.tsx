import { PERMISSION } from '@libs/permissions-shared/permission-catalog';
import { Trans, useLingui } from '@lingui/solid/macro';
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
    <button
      class="clickable clickableTint py-2 px-4 bg-surface-muted rounded-full"
      type="button"
      onClick={onPress}
      role="button"
      aria-label={canEndSpace() ? t`End space` : t`Leave space`}
    >
      <p class="text textFootnote">
        {
          <Show when={canEndSpace()} fallback={<Trans>Leave</Trans>}>
            <Trans>End</Trans>
          </Show>
        }
      </p>
    </button>
  );
}

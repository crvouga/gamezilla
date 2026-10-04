import { Trans } from '@lingui/solid/macro';
import { StatusDot } from '@pkgs/ui-client/status-dot';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { useIsSpaceOpenLocally } from './use-open-space-session-ids';
import { SpaceField, useSpaceColumn } from './use-space-column';

export type SpaceLiveBadgeProps = {
  spaceId: string;
};

function SpaceStatusPill(props: {
  readonly label: JSX.Element;
  readonly showDot: boolean;
}): JSX.Element {
  return (
    <div class="box flex-row items-center gap-1 bg-on-tint-scrim rounded-full px-2 py-1 self-start">
      <Show when={props.showDot}>
        <StatusDot status="online" size={8} />
      </Show>
      <p class="text textCaption text-on-primary">{props.label}</p>
    </div>
  );
}

/**
 * Status pill on space cards — "Current" when this device has the space open
 * (miniplayer), otherwise "Live" while the space has not ended.
 */
export function SpaceLiveBadge(props: SpaceLiveBadgeProps): JSX.Element {
  const endedAt = useSpaceColumn(props.spaceId, SpaceField.endedAt);
  const isOpen = useIsSpaceOpenLocally(props.spaceId);
  return (
    <Show when={endedAt() === null}>
      <Show
        when={isOpen()}
        fallback={<SpaceStatusPill label={<Trans>Live</Trans>} showDot />}
      >
        <SpaceStatusPill label={<Trans>Current</Trans>} showDot={false} />
      </Show>
    </Show>
  );
}

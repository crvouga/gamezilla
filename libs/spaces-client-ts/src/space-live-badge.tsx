import { Trans } from '@lingui/solid/macro';
import { Badge, LiveBadge } from '@pkgs/ui-root-client-ts/badge';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';

import { useIsSpaceOpenLocally } from './use-open-space-session-ids';
import { SpaceField, useSpaceColumn } from './use-space-column';

export type SpaceLiveBadgeProps = {
  spaceId: string;
};

/**
 * Status tag on space cards — "Current" when this device has the space open
 * (miniplayer), otherwise the LIVE tag while the space has not ended.
 */
export function SpaceLiveBadge(props: SpaceLiveBadgeProps): JSX.Element {
  const endedAt = useSpaceColumn(props.spaceId, SpaceField.endedAt);
  const isOpen = useIsSpaceOpenLocally(props.spaceId);
  return (
    <Show when={endedAt() === null}>
      <Show when={isOpen()} fallback={<LiveBadge />}>
        <Badge label={<Trans>Current</Trans>} intent="brand" tone="solid" />
      </Show>
    </Show>
  );
}

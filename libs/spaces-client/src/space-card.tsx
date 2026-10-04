import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import {
  SPACE_CARD_BORDER_RADIUS,
  SpaceCardGradientBox,
} from './space-card-gradient';
import { SpaceCardOpenLink } from './space-card-open-link';
import { SpaceGuestSection } from './space-guest-section';
import { SpaceSummaryHeader } from './space-summary-header';
import { useIsSpaceOpenLocally } from './use-open-space-session-ids';
import { SpaceField, useSpaceColumn } from './use-space-column';

export type SpaceCardProps = {
  spaceId: string;
};

/** Live lobby card — ended spaces are omitted so they disappear immediately. */
export function SpaceCard(props: SpaceCardProps): JSX.Element {
  const current = useIsSpaceOpenLocally(() => props.spaceId);
  const endedAt = useSpaceColumn(() => props.spaceId, SpaceField.endedAt);
  return (
    <Show when={endedAt() === null}>
      <SpaceCardOpenLink spaceId={props.spaceId}>
        <SpaceCardGradientBox
          class="p-4"
          style={{
            'border-radius': `${SPACE_CARD_BORDER_RADIUS}px`,
            'border-width': current() ? '2px' : '0',
            'border-style': 'solid',
            ...(current()
              ? { 'border-color': 'var(--ui-color-on-primary)' }
              : {}),
          }}
        >
          <SpaceSummaryHeader spaceId={props.spaceId} />
          <SpaceGuestSection spaceId={props.spaceId} />
        </SpaceCardGradientBox>
      </SpaceCardOpenLink>
    </Show>
  );
}

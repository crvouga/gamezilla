import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { SpaceField, useSpaceColumn } from '../../../public/use-space-column';
import { useIsSpaceOpenLocally } from '../../../use-cases/list-open-sessions/client/use-open-space-session-ids';
import { SpaceGuestSection } from '../members/space-guest-section';
import {
  SPACE_CARD_BORDER_RADIUS,
  SpaceCardGradientBox,
} from './space-card-gradient';
import { SpaceCardOpenLink } from './space-card-open-link';
import { SpaceSummaryHeader } from './space-summary-header';

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
          sx={{
            borderRadius: SPACE_CARD_BORDER_RADIUS,
            p: 4,
            borderWidth: current() ? 2 : 0,
            ...(current() ? { borderColor: 'onPrimary' as const } : {}),
          }}
        >
          <SpaceSummaryHeader spaceId={props.spaceId} />
          <SpaceGuestSection spaceId={props.spaceId} />
        </SpaceCardGradientBox>
      </SpaceCardOpenLink>
    </Show>
  );
}

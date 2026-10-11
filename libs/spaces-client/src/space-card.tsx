import { Handles } from '@libs/test-ids-shared/handles';
import type { JSX } from 'solid-js';
import { Show } from 'solid-js';
import { SpaceCardOpenLink } from './space-card-open-link';
import { SpaceGuestSection } from './space-guest-section';
import { SpaceSummaryHeader } from './space-summary-header';
import { SpaceField, useSpaceColumn } from './use-space-column';

export type SpaceCardProps = {
  spaceId: string;
};

/** One row in the lobby panel. Ended spaces are omitted so they disappear. */
export function SpaceCard(props: SpaceCardProps): JSX.Element {
  const endedAt = useSpaceColumn(() => props.spaceId, SpaceField.endedAt);
  return (
    <Show when={endedAt() === null}>
      <div class="panelItem">
        <SpaceCardOpenLink spaceId={props.spaceId}>
          <div
            class="box p-4"
            data-testid={Handles.spaceLobbyCard(props.spaceId)}
          >
            <SpaceSummaryHeader spaceId={props.spaceId} />
            <SpaceGuestSection spaceId={props.spaceId} />
          </div>
        </SpaceCardOpenLink>
      </div>
    </Show>
  );
}

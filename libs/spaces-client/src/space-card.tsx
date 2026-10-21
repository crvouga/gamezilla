import { Handles } from '@libs/test-ids-shared/handles';
import { StackVertical } from '@pkgs/ui-root-client/stack';
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
      <SpaceCardOpenLink spaceId={props.spaceId}>
        <StackVertical
          padding="lg"
          gap="md"
          testId={Handles.spaceLobbyCard(props.spaceId)}
        >
          <SpaceSummaryHeader spaceId={props.spaceId} />
          <SpaceGuestSection spaceId={props.spaceId} />
        </StackVertical>
      </SpaceCardOpenLink>
    </Show>
  );
}

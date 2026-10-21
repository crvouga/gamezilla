import { Handles } from '@libs/test-ids-shared/handles';
import { MiniPlayerBar } from '@pkgs/ui-root-client/mini-player';
import { StackVertical } from '@pkgs/ui-root-client/stack';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import type { RequestEndSpaceOptions } from './end-space-modal-provider';
import type { RequestLeaveSpaceOptions } from './leave-space-modal-provider';
import { MiniplayerLiveBadge } from './miniplayer-live-badge';
import { MiniplayerOpenSpacePressable } from './miniplayer-open-space-pressable';
import { MiniplayerSpaceSummary } from './miniplayer-space-summary';
import { SpaceEndOrLeaveButton } from './space-end-or-leave-button';
import { SpaceField, useSpaceColumn } from './use-space-column';

export type SpaceMiniplayerCardProps = {
  spaceId: string;
  requestEndSpace: (spaceId: string, options?: RequestEndSpaceOptions) => void;
  requestLeaveSpace: (
    spaceId: string,
    options?: RequestLeaveSpaceOptions
  ) => void;
};

/** A single miniplayer entry — hidden once DB stamps `ended_at`. */
export function SpaceMiniplayerCard(
  props: SpaceMiniplayerCardProps
): JSX.Element {
  const endedAt = useSpaceColumn(props.spaceId, SpaceField.endedAt);
  // Treat only real timestamps as ended (empty/undefined → still live).
  const live = createMemo((): boolean => {
    const current = endedAt();
    return current === null || current.length === 0;
  });
  return (
    <Show when={live()}>
      <MiniPlayerBar testId={Handles.spaceMiniplayer}>
        <MiniplayerOpenSpacePressable spaceId={props.spaceId} paddingStart="md">
          <MiniplayerSpaceSummary spaceId={props.spaceId} />
          <MiniplayerLiveBadge />
        </MiniplayerOpenSpacePressable>
        <StackVertical paddingEnd="md">
          <SpaceEndOrLeaveButton
            spaceId={props.spaceId}
            requestEndSpace={props.requestEndSpace}
            requestLeaveSpace={props.requestLeaveSpace}
          />
        </StackVertical>
      </MiniPlayerBar>
    </Show>
  );
}

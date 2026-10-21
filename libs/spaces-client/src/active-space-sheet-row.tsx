import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client/stack';
import type { JSX } from 'solid-js';
import type { RequestEndSpaceOptions } from './end-space-modal-provider';
import type { RequestLeaveSpaceOptions } from './leave-space-modal-provider';
import { MiniplayerLiveBadge } from './miniplayer-live-badge';
import { MiniplayerOpenSpacePressable } from './miniplayer-open-space-pressable';
import { MiniplayerSpaceSummary } from './miniplayer-space-summary';
import { SpaceEndOrLeaveButton } from './space-end-or-leave-button';

export type ActiveSpaceSheetRowProps = {
  spaceId: string;
  onOpen: () => void;
  requestEndSpace: (spaceId: string, options?: RequestEndSpaceOptions) => void;
  requestLeaveSpace: (
    spaceId: string,
    options?: RequestLeaveSpaceOptions
  ) => void;
};

/** One live space in the active-spaces sheet — open, end, or leave. */
export function ActiveSpaceSheetRow(
  props: ActiveSpaceSheetRowProps
): JSX.Element {
  return (
    <StackHorizontal align="center" gap="md" minHeight="row">
      <MiniplayerOpenSpacePressable
        spaceId={props.spaceId}
        paddingStart="lg"
        onAfterOpen={props.onOpen}
      >
        <MiniplayerSpaceSummary spaceId={props.spaceId} />
        <MiniplayerLiveBadge />
      </MiniplayerOpenSpacePressable>
      <StackVertical paddingEnd="lg">
        <SpaceEndOrLeaveButton
          spaceId={props.spaceId}
          requestEndSpace={props.requestEndSpace}
          requestLeaveSpace={props.requestLeaveSpace}
        />
      </StackVertical>
    </StackHorizontal>
  );
}

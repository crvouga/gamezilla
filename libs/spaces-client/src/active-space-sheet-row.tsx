import { CONTENT_EDGE_PADDING_STEP } from '@pkgs/ui-client/content-edge-padding';
import type { JSX } from 'solid-js';
import type { RequestEndSpaceOptions } from './end-space-modal-provider';
import type { RequestLeaveSpaceOptions } from './leave-space-modal-provider';
import { MiniplayerHostNameLine } from './miniplayer-host-name-line';
import { MiniplayerLiveBadge } from './miniplayer-live-badge';
import { MiniplayerMemberCountText } from './miniplayer-member-count-text';
import { MiniplayerOpenSpacePressable } from './miniplayer-open-space-pressable';
import { MiniplayerSpaceTitle } from './miniplayer-space-title';
import { SpaceEndOrLeaveButton } from './space-end-or-leave-button';
import { SpaceHostAvatar } from './space-host-avatar';

export type ActiveSpaceSheetRowProps = {
  spaceId: string;
  onOpen: () => void;
  requestEndSpace: (spaceId: string, options?: RequestEndSpaceOptions) => void;
  requestLeaveSpace: (
    spaceId: string,
    options?: RequestLeaveSpaceOptions
  ) => void;
};

/** Horizontal inset inside the sheet list (above the surface edge pad). */
const ROW_EDGE_PADDING_STEP = CONTENT_EDGE_PADDING_STEP + 2;

/** One live space in the active-spaces sheet — open, end, or leave. */
export function ActiveSpaceSheetRow(
  props: ActiveSpaceSheetRowProps
): JSX.Element {
  return (
    <div class="box flex-row items-center gap-3 min-h-18 border-b border-border">
      <MiniplayerOpenSpacePressable
        spaceId={props.spaceId}
        onAfterOpen={props.onOpen}
      >
        <div
          class="box flex-row items-center gap-3 flex-1 min-w-0 py-3 self-stretch"
          style={{ 'padding-left': `${ROW_EDGE_PADDING_STEP * 4}px` }}
        >
          <SpaceHostAvatar spaceId={props.spaceId} size={40} vividBackdrop />
          <div class="box flex-1 min-w-0 gap-0.5">
            <MiniplayerSpaceTitle spaceId={props.spaceId} />
            <div class="box flex-row items-center gap-1.5 min-w-0">
              <MiniplayerHostNameLine spaceId={props.spaceId} />
              <p class="text textCaption">{'·'}</p>
              <MiniplayerMemberCountText spaceId={props.spaceId} />
            </div>
          </div>
        </div>
        <MiniplayerLiveBadge />
      </MiniplayerOpenSpacePressable>
      <div
        class="box pl-1"
        style={{ 'padding-right': `${ROW_EDGE_PADDING_STEP * 4}px` }}
      >
        <SpaceEndOrLeaveButton
          spaceId={props.spaceId}
          requestEndSpace={props.requestEndSpace}
          requestLeaveSpace={props.requestLeaveSpace}
        />
      </div>
    </div>
  );
}

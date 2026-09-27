import { Handles } from '@libs/test-ids';
import type { JSX } from 'solid-js';
import { createMemo, Show } from 'solid-js';
import { SpaceField, useSpaceColumn } from '../../../public/use-space-column';
import { SpaceCardGradientBox } from '../card/space-card-gradient';
import type { RequestEndSpaceOptions } from '../end-space/end-space-modal-provider';
import type { RequestLeaveSpaceOptions } from '../leave-space/leave-space-modal-provider';
import { SpaceHostAvatar } from '../members/space-host-avatar';
import { MiniplayerHostNameLine } from './miniplayer-host-name-line';
import { MiniplayerLiveBadge } from './miniplayer-live-badge';
import { MiniplayerMemberCountText } from './miniplayer-member-count-text';
import { MiniplayerOpenSpacePressable } from './miniplayer-open-space-pressable';
import { MiniplayerSpaceTitle } from './miniplayer-space-title';
import { SpaceEndOrLeaveButton } from './space-end-or-leave-button';

export type SpaceMiniplayerCardProps = {
  spaceId: string;
  /** Corner radius — `0` for the compact full-bleed strip, card radius on wide. */
  borderRadius: number;
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
      <SpaceCardGradientBox
        dataSet={{ testid: Handles.spaceMiniplayer }}
        class="overflow-hidden flex-row items-center gap-2 min-h-18"
        style={{ 'border-radius': `${props.borderRadius}px` }}
      >
        <MiniplayerOpenSpacePressable spaceId={props.spaceId}>
          <div class="box p-3 flex-row items-center gap-3 flex-1 min-w-0 self-stretch">
            <SpaceHostAvatar spaceId={props.spaceId} size={40} vividBackdrop />
            <div class="box flex-1 min-w-0 gap-0.5">
              <MiniplayerSpaceTitle
                spaceId={props.spaceId}
                class="text-on-primary"
              />
              <div class="box flex-row items-center gap-1.5 min-w-0">
                <MiniplayerHostNameLine
                  spaceId={props.spaceId}
                  class="text-on-primary"
                />
                <p class="text textCaption text-on-primary">{'·'}</p>
                <MiniplayerMemberCountText
                  spaceId={props.spaceId}
                  class="text-on-primary"
                />
              </div>
            </div>
          </div>
          <MiniplayerLiveBadge />
        </MiniplayerOpenSpacePressable>
        <div class="box pr-3">
          <SpaceEndOrLeaveButton
            spaceId={props.spaceId}
            requestEndSpace={props.requestEndSpace}
            requestLeaveSpace={props.requestLeaveSpace}
          />
        </div>
      </SpaceCardGradientBox>
    </Show>
  );
}

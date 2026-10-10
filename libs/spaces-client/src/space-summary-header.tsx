import type { JSX } from 'solid-js';
import { SpaceHostAvatar } from './space-host-avatar';
import { SpaceHostNameText } from './space-host-name-text';
import { SpaceLiveBadge } from './space-live-badge';
import { SpaceTitleText } from './space-title-text';

export type SpaceSummaryHeaderProps = {
  spaceId: string;
  hostAvatarSize?: number;
};

const DEFAULT_HOST_AVATAR_SIZE = 44;

export function SpaceSummaryHeader(
  props: SpaceSummaryHeaderProps
): JSX.Element {
  return (
    <div class="box flex-row justify-between">
      <div class="box flex-row items-center gap-2 flex-1">
        <SpaceHostAvatar
          spaceId={props.spaceId}
          size={props.hostAvatarSize ?? DEFAULT_HOST_AVATAR_SIZE}
          vividBackdrop
        />
        <div class="box flex-1 gap-0.5">
          <SpaceTitleText
            spaceId={props.spaceId}
            variant="bodyBold"
            numberOfLines={1}
          />
          <SpaceHostNameText
            spaceId={props.spaceId}
            variant="caption"
            class="text-text-secondary"
            numberOfLines={1}
          />
        </div>
      </div>
      <SpaceLiveBadge spaceId={props.spaceId} />
    </div>
  );
}

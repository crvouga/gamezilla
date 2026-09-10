import type { JSX } from 'solid-js';
import { SpaceLiveBadge } from '../../../public/space-live-badge';
import { SpaceHostAvatar } from '../members/space-host-avatar';
import { SpaceHostNameText } from '../members/space-host-name-text';
import { SpaceTitleText } from '../space-title-text';

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
          <SpaceHostNameText spaceId={props.spaceId} variant="caption" />
        </div>
      </div>
      <SpaceLiveBadge spaceId={props.spaceId} />
    </div>
  );
}

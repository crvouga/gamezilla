import { Handles } from '@libs/test-ids';
import { Trans } from '@lingui/solid/macro';
import { dataAttrs } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { useSpaceHostUsername } from '../use-space-host-username';
import { SpaceCardGradientBox } from './space-card-gradient';
import { SpaceCardOpenLink } from './space-card-open-link';
import { SpaceSummaryHeader } from './space-summary-header';

/** Ended-space history card. Opening it returns to the space's detail screen. */
export function RecentSpaceCard(props: {
  readonly spaceId: string;
}): JSX.Element {
  const hostUsername = useSpaceHostUsername(() => props.spaceId);
  return (
    <div
      {...dataAttrs(
        hostUsername() !== null
          ? { testid: Handles.spaceRecentCard(hostUsername() ?? '') }
          : undefined
      )}
    >
      <SpaceCardOpenLink spaceId={props.spaceId} testId={null}>
        <SpaceCardGradientBox class="p-4 gap-1">
          <SpaceSummaryHeader spaceId={props.spaceId} />
          <p class="text textCaption text-on-primary opacity-80">
            <Trans>Ended</Trans>
          </p>
        </SpaceCardGradientBox>
      </SpaceCardOpenLink>
    </div>
  );
}

import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import { SpaceCardSurface } from './space-card-surface';
import { SpaceGuestSection } from './space-guest-section';
import { SpaceSummaryHeader } from './space-summary-header';

export type SpaceJoinLiveBodyProps = {
  spaceId: string;
};

/** Live (not joined) preview: summary card and helper copy. */
export function SpaceJoinLiveBody(props: SpaceJoinLiveBodyProps): JSX.Element {
  return (
    <div class="box gap-4">
      <SpaceCardSurface class="p-4">
        <SpaceSummaryHeader spaceId={props.spaceId} />
        <SpaceGuestSection spaceId={props.spaceId} />
      </SpaceCardSurface>
      <p class="text textBody text-text-secondary">
        <Trans>Join to see who is here and hang out.</Trans>
      </p>
    </div>
  );
}

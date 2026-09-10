import { Trans } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import { SpaceCardGradientBox } from '../../../root/client/card/space-card-gradient';
import { SpaceSummaryHeader } from '../../../root/client/card/space-summary-header';
import { SpaceGuestSection } from '../../../root/client/members/space-guest-section';

export type SpaceJoinLiveBodyProps = {
  spaceId: string;
};

/** Live (not joined) preview: summary card and helper copy. */
export function SpaceJoinLiveBody(props: SpaceJoinLiveBodyProps): JSX.Element {
  return (
    <div class="box gap-4">
      <SpaceCardGradientBox class="p-4">
        <SpaceSummaryHeader spaceId={props.spaceId} />
        <SpaceGuestSection spaceId={props.spaceId} />
      </SpaceCardGradientBox>
      <p class="text text-text-secondary">
        <Trans>Join to see who is here and hang out.</Trans>
      </p>
    </div>
  );
}

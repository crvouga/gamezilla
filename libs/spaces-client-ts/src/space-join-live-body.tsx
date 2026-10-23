import { Trans } from '@lingui/solid/macro';
import { Card } from '@pkgs/ui-root-client-ts/card';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import type { JSX } from 'solid-js';
import { SpaceGuestSection } from './space-guest-section';
import { SpaceSummaryHeader } from './space-summary-header';

export type SpaceJoinLiveBodyProps = {
  spaceId: string;
};

/** Live (not joined) preview: summary card and helper copy. */
export function SpaceJoinLiveBody(props: SpaceJoinLiveBodyProps): JSX.Element {
  return (
    <StackVertical gap="lg">
      <Card>
        <SpaceSummaryHeader spaceId={props.spaceId} />
        <SpaceGuestSection spaceId={props.spaceId} />
      </Card>
      <P tone="secondary">
        <Trans>Join to see who is here and hang out.</Trans>
      </P>
    </StackVertical>
  );
}

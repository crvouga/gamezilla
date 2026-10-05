import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import { useBreadcrumbNav } from '@pkgs/ui-root-client/use-breadcrumb-nav';
import type { JSX } from 'solid-js';
import { SpaceJoinEndedState } from './space-join-ended-state';
import { SpaceTitleText } from './space-title-text';

export type SpaceEndedScreenProps = {
  spaceId: string;
};

/** Terminal screen after a space ends (host end or deep-link to ended space). */
export function SpaceEndedScreen(props: SpaceEndedScreenProps): JSX.Element {
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      screenId="space-ended"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onClick: nav('/') },
        {
          name: (
            <SpaceTitleText spaceId={props.spaceId} variant="navigationTitle" />
          ),
        },
      ]}
      content={({ bodyClass }) => (
        <div class={`box ${bodyClass}`} data-testid={Handles.spaceEnded}>
          <SpaceJoinEndedState spaceId={props.spaceId} />
        </div>
      )}
    />
  );
}

import { Trans } from '@lingui/solid/macro';
import { Box, ScreenBase, useBreadcrumbNav } from '@pkgs/ui';
import type { JSX } from 'solid-js';
import { SpaceTitleText } from '../../../root/client/space-title-text';
import { SpaceJoinEndedState } from './space-join-ended-state';

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
      content={({ sx }) => (
        <Box sx={sx}>
          <SpaceJoinEndedState spaceId={props.spaceId} />
        </Box>
      )}
    />
  );
}

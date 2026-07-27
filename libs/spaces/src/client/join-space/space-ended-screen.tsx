import { SpaceJoinEndedState } from './space-join-ended-state';
import { SpaceTitleText } from '../space-title-text';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import { Box, ScreenBase } from '@pkgs/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

export type SpaceEndedScreenProps = {
  spaceId: string;
};

/** Terminal screen after a space ends (host end or deep-link to ended space). */
export function SpaceEndedScreen({
  spaceId,
}: SpaceEndedScreenProps): ReactNode {
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      screenId="space-ended"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onPress: nav('/') },
        {
          name: <SpaceTitleText spaceId={spaceId} variant="navigationTitle" />,
        },
      ]}
      content={({ sx }) => (
        <Box style={sx}>
          <SpaceJoinEndedState spaceId={spaceId} />
        </Box>
      )}
    />
  );
}

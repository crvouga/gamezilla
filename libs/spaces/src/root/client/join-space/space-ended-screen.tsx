import { Trans } from '@lingui/react/macro';
import { Box, ScreenBase } from '@pkgs/ui';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import type { ReactNode } from 'react';
import { SpaceTitleText } from '../../../root/client/space-title-text';
import { SpaceJoinEndedState } from './space-join-ended-state';

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
        <Box sx={sx}>
          <SpaceJoinEndedState spaceId={spaceId} />
        </Box>
      )}
    />
  );
}

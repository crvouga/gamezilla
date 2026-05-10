import { useBreadcrumbNav } from '@gamezilla/client/ui/use-breadcrumb-nav';
import { Center, ScreenBase, Spinner } from '@gamezilla/ui';
import { Trans } from '@lingui/react/macro';
import type { ReactNode } from 'react';

/** Static loading view for the space detail screen. */
export function SpaceLoadingScreen(): ReactNode {
  const nav = useBreadcrumbNav();
  return (
    <ScreenBase
      breadcrumbs={[{ name: <Trans>Spaces</Trans>, onPress: nav('/') }]}
      content={({ sx }) => (
        <Center style={sx} sx={{ flex: 1 }}>
          <Spinner size="large" />
        </Center>
      )}
    />
  );
}

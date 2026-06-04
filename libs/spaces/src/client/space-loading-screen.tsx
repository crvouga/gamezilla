import { Trans } from '@lingui/react/macro';
import { LoadingState, ScreenBase } from '@pkgs/ui';
import { useBreadcrumbNav } from '@pkgs/ui/components/use-breadcrumb-nav';
import type { ReactNode } from 'react';

/** Static loading view for the space detail screen. */
export function SpaceLoadingScreen(): ReactNode {
  const nav = useBreadcrumbNav();
  return (
    <ScreenBase
      breadcrumbs={[{ name: <Trans>Spaces</Trans>, onPress: nav('/') }]}
      content={() => <LoadingState size="large" />}
    />
  );
}

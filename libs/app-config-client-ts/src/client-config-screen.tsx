import { Trans } from '@lingui/solid/macro';
import { MenuScreen } from '@pkgs/ui-root-client-ts/menu-screen';
import { useBreadcrumbNav } from '@pkgs/ui-root-client-ts/use-breadcrumb-nav';

import { ClientConfigEntityCard } from './client-config-entity-card';

export function ClientConfigScreen() {
  const nav = useBreadcrumbNav();

  return (
    <MenuScreen
      screenId="client-config"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onClick: nav('/') },
        { name: <Trans>Settings</Trans>, onClick: nav('/more') },
        { name: <Trans>Client config</Trans> },
      ]}
    >
      <ClientConfigEntityCard />
    </MenuScreen>
  );
}

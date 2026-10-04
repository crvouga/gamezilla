import { Trans } from '@lingui/solid/macro';
import { ScreenBase } from '@pkgs/ui-root-client/screen-base';
import { useBreadcrumbNav } from '@pkgs/ui-root-client/use-breadcrumb-nav';

import { ClientConfigEntityCard } from './client-config-entity-card';

export function ClientConfigScreen() {
  const nav = useBreadcrumbNav();

  return (
    <ScreenBase
      screenId="client-config"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, onClick: nav('/') },
        { name: <Trans>Settings</Trans>, onClick: nav('/more') },
        { name: <Trans>Client config</Trans> },
      ]}
      scroll
      content={({ bodyClass }) => (
        <div class={`box gap-5 ${bodyClass}`}>
          <ClientConfigEntityCard />
        </div>
      )}
    />
  );
}

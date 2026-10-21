/** @jsxImportSource solid-js */

import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import type { JSX } from 'solid-js';

export default function ClientEventsRoute(): JSX.Element {
  return (
    <ContentScreen
      screenId="client-events"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Client events</Trans> },
      ]}
    >
      <EmptyState
        title={<Trans>Not available in this app</Trans>}
        body={
          <Trans>
            Client events are available in the embedded product-harness.
          </Trans>
        }
      />
    </ContentScreen>
  );
}

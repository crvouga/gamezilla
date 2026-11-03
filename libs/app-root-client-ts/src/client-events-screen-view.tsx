/** @jsxImportSource solid-js */

import { Trans } from '@lingui/solid/macro';
import { ContentScreen } from '@pkgs/ui-root-client-ts/content-screen';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import type { JSX } from 'solid-js';

/**
 * `/client/events`, presentational: the client events inspector exists only
 * in the embedded product harness, so the standalone app says where to find
 * it. It takes no data.
 */
export function ClientEventsScreenView(): JSX.Element {
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

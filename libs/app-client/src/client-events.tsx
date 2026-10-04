/** @jsxImportSource solid-js */

import { Trans } from '@lingui/solid/macro';
import { ScreenBase } from '@pkgs/ui-client/screen-base';
import type { JSX } from 'solid-js';

export default function ClientEventsRoute(): JSX.Element {
  return (
    <ScreenBase
      screenId="client-events"
      breadcrumbs={[
        { name: <Trans>Spaces</Trans>, href: '/' },
        { name: <Trans>Settings</Trans>, href: '/more' },
        { name: <Trans>Client events</Trans> },
      ]}
      content={() => (
        <p class="text">
          {
            <Trans>
              Client events are available in the embedded product-harness.
            </Trans>
          }
        </p>
      )}
    />
  );
}

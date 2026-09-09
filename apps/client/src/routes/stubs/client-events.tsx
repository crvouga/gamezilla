/** @jsxImportSource solid-js */

import { Trans } from '@lingui/solid/macro';
import { ScreenBase, Text } from '@pkgs/ui';
import type { JSX } from 'solid-js';

export default function ClientEventsRoute(): JSX.Element {
  return (
    <ScreenBase
      screenId="client-events"
      breadcrumbs={[{ name: <Trans>Client events</Trans> }]}
      content={() => (
        <Text
          label={
            <Trans>
              Client events are available in the embedded playground.
            </Trans>
          }
        />
      )}
    />
  );
}

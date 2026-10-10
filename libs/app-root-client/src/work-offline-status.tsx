/** @jsxImportSource solid-js */
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client/badge';
import { type JSX, Show } from 'solid-js';
import { useOfflinePreference } from './offline-preference';

/** Keep the deliberate offline choice visible from every place in the app. */
export function WorkOfflineStatus(): JSX.Element {
  const { offline } = useOfflinePreference();
  return (
    <Show when={offline()}>
      <Badge
        label={<Trans>Work offline</Trans>}
        intent="neutral"
        size="sm"
        dataSet={{ testid: Handles.statusWorkOffline }}
      />
    </Show>
  );
}

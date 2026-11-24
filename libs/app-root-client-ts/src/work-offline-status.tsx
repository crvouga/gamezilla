/** @jsxImportSource @solidjs/web */
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans } from '@pkgs/lingui-solid-client-ts/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import type { JSX } from '@solidjs/web';
import { Show } from 'solid-js';
import { useOfflinePreference } from './offline-preference';

/** Keep the deliberate offline choice visible from every place in the app. */
export function WorkOfflineStatus(): JSX.Element {
  const { offline } = useOfflinePreference();
  return (
    <Show when={offline()}>
      <Badge
        label={<Trans>Working offline</Trans>}
        intent="neutral"
        size="sm"
        dataSet={{ testid: Handles.statusWorkOffline }}
      />
    </Show>
  );
}

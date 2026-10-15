/** @jsxImportSource solid-js */
import { Handles } from '@libs/test-ids-shared/handles';
import { Trans } from '@lingui/solid/macro';
import { createOriginAvailabilitySnapshot } from '@pkgs/http-client-client/solid';
import { InFlowBanner } from '@pkgs/ui-root-client/dismissible-top-banner';
import { Notice } from '@pkgs/ui-root-client/notice';
import type { JSX } from 'solid-js';
import { useOfflinePreference } from './offline-preference';
import { createNetworkOnline } from './use-connectivity';

/** Local content remains mounted while shared connectivity recovers. */
export function ConnectionNotice(): JSX.Element {
  const online = createNetworkOnline();
  const origin = createOriginAvailabilitySnapshot();
  const { offline } = useOfflinePreference();
  const missing = (): boolean =>
    offline() || !online() || origin().phase !== 'available';
  return (
    <InFlowBanner visible={missing()}>
      <div
        role="status"
        aria-live="polite"
        data-component="ConnectionNotice"
        data-testid={Handles.statusConnectionMissing}
      >
        <Notice>
          <Trans>
            Connection unavailable. Saved content and local games remain
            available. Shared changes will reconnect automatically.
          </Trans>
        </Notice>
      </div>
    </InFlowBanner>
  );
}

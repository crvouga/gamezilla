/** @jsxImportSource solid-js */
import { Handles } from '@libs/test-ids-shared/handles';
import { useLingui } from '@lingui/solid/macro';
import { createOriginAvailabilitySnapshot } from '@pkgs/http-client-client/solid';
import { WifiOffIcon } from '@pkgs/ui-root-client/icons';
import { StatusIconSlot } from '@pkgs/ui-root-client/status-icon-slot';
import type { JSX } from 'solid-js';
import { useOfflinePreference } from './offline-preference';
import { createNetworkOnline } from './use-connectivity';

/** A reserved header slot keeps content still as connectivity changes. */
export function ConnectionNotice(): JSX.Element {
  const online = createNetworkOnline();
  const origin = createOriginAvailabilitySnapshot();
  const { offline } = useOfflinePreference();
  const missing = (): boolean =>
    offline() || !online() || origin().phase !== 'available';
  return <ConnectionStatusIndicator missing={missing()} />;
}

export function ConnectionStatusIndicator(props: {
  readonly missing: boolean;
}): JSX.Element {
  const { t } = useLingui();
  const label = () =>
    t`Connection unavailable. Saved content and local games remain available. Shared changes will reconnect automatically.`;
  return (
    <StatusIconSlot
      shown={props.missing}
      icon={WifiOffIcon}
      label={label()}
      testId={Handles.statusConnectionMissing}
    />
  );
}

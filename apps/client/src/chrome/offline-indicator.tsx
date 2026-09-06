/** @jsxImportSource solid-js */
/**
 * Top banner when the device is offline or API sync has failed. Driven by the
 * injected network port + sync status (`createConnectivity`). Dismiss hides it
 * until connectivity changes again.
 */

import { Trans, useLingui } from '@lingui/solid/macro';
import { DismissibleBanner } from '@pkgs/ui';
import { createEffect, createSignal, type JSX, on } from 'solid-js';

import { createConnectivity } from './use-connectivity';

export function OfflineIndicator(): JSX.Element {
  const { t } = useLingui();
  const connectivity = createConnectivity();
  const problem = (): boolean =>
    !connectivity.online() || connectivity.syncError();
  const [dismissed, setDismissed] = createSignal(false);
  // A new problem (or recovery) resets the dismissal.
  createEffect(on(problem, () => setDismissed(false), { defer: true }));

  return (
    <DismissibleBanner
      visible={problem() && !dismissed()}
      onDismiss={() => setDismissed(true)}
      position="top"
      title={connectivity.online() ? t`Sync issue` : t`Offline`}
      subtitle={
        <Trans>
          Your changes are saved locally and will sync when you are back online.
        </Trans>
      }
      dataSet={{ testid: 'offline-indicator' }}
    />
  );
}

/** @jsxImportSource solid-js */
/**
 * Top banner for sticky sync failures while the device is online. Offline is
 * expected (local-first) — no banner; the header status dot / Sync screen cover
 * that. Driven by `createConnectivity`. Dismiss hides until sync recovers.
 */

import { Trans, useLingui } from '@lingui/solid/macro';
import { DismissibleBanner } from '@pkgs/ui-client/dismissible-top-banner';
import { createEffect, createSignal, type JSX, on } from 'solid-js';

import { useSyncStatus } from './sync-status-context';
import { createConnectivity } from './use-connectivity';

export function OfflineIndicator(): JSX.Element {
  const { t } = useLingui();
  const connectivity = createConnectivity();
  const syncStatus = useSyncStatus();
  // Browser offline (and sync blips while offline) are normal — never banner.
  // An outdated app is asked to update instead (`AppUpdateRequiredBanner`).
  const problem = (): boolean =>
    connectivity.online() &&
    connectivity.syncError() &&
    !syncStatus().upgradeRequired;
  const [dismissed, setDismissed] = createSignal(false);
  // Re-arm only after recovery so intermittent sync errors don't re-show
  // a banner the user already dismissed.
  createEffect(
    on(
      problem,
      (isProblem) => {
        if (!isProblem) setDismissed(false);
      },
      { defer: true }
    )
  );

  return (
    <DismissibleBanner
      visible={problem() && !dismissed()}
      onDismiss={() => setDismissed(true)}
      position="top"
      tone="warning"
      title={t`Sync issue`}
      subtitle={
        <Trans>
          Your changes are saved locally and will sync when the connection is
          healthy again.
        </Trans>
      }
      dataSet={{ testid: 'offline-indicator' }}
    />
  );
}

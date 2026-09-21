/** @jsxImportSource solid-js */
/**
 * Top banner for sticky sync failures while the device is online. Offline is
 * expected (local-first) — no banner; the header status dot / Sync screen cover
 * that. Driven by `createConnectivity`. Dismiss hides until sync recovers.
 */

import { Trans, useLingui } from '@lingui/solid/macro';
import { DismissibleBanner } from '@pkgs/ui';
import { createEffect, createSignal, type JSX, on } from 'solid-js';

import { createConnectivity } from './use-connectivity';

export function OfflineIndicator(): JSX.Element {
  const { t } = useLingui();
  const connectivity = createConnectivity();
  // Browser offline (and sync blips while offline) are normal — never banner.
  const problem = (): boolean =>
    connectivity.online() && connectivity.syncError();
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

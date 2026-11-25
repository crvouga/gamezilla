/** @jsxImportSource @solidjs/web */
/**
 * Top banner when the product no longer accepts this version of the app
 * (sync `upgrade_required`): the person is asked to update instead of being
 * shown sync errors. Nothing local is lost — the app keeps its data and
 * catches up once updated. Dismiss hides it until the app is reopened.
 */

import { reloadApp } from '@libs/app-root-shared-ts/reload-app';
import type { JSX } from '@solidjs/web';
import { createSignal } from 'solid-js';
import { AppUpdateRequiredBannerView } from './app-update-required-view';
import { useSyncStatus } from './sync-status-context';

export function AppUpdateRequiredBanner(): JSX.Element {
  const syncStatus = useSyncStatus();
  const [dismissed, setDismissed] = createSignal(false);
  return (
    <AppUpdateRequiredBannerView
      visible={syncStatus().upgradeRequired && !dismissed()}
      onDismiss={() => setDismissed(true)}
      onUpdate={() => reloadApp()}
    />
  );
}

/** @jsxImportSource solid-js */
/**
 * Top banner when the product no longer accepts this version of the app
 * (sync `upgrade_required`): the person is asked to update instead of being
 * shown sync errors. Nothing local is lost — the app keeps its data and
 * catches up once updated. Dismiss hides it until the app is reopened.
 */

import { reloadApp } from '@libs/app-root-shared-ts/reload-app';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { DismissibleBanner } from '@pkgs/ui-root-client-ts/dismissible-top-banner';
import { createSignal, type JSX } from 'solid-js';
import { useSyncStatus } from './sync-status-context';

export function AppUpdateRequiredBanner(): JSX.Element {
  const { t } = useLingui();
  const syncStatus = useSyncStatus();
  const [dismissed, setDismissed] = createSignal(false);
  return (
    <DismissibleBanner
      visible={syncStatus().upgradeRequired && !dismissed()}
      onDismiss={() => setDismissed(true)}
      position="top"
      tone="warning"
      title={t`Update the app`}
      subtitle={
        <Trans>
          This version of the app is out of date. Update it to keep playing with
          others — everything you did is kept.
        </Trans>
      }
      actionLabel={t`Update`}
      onActionClick={() => reloadApp()}
      dataSet={{ testid: Handles.appUpdateRequired }}
    />
  );
}

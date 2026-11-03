/** @jsxImportSource solid-js */

import { Handles } from '@libs/test-ids-shared-ts/handles';
import { Trans, useLingui } from '@lingui/solid/macro';
import { DismissibleBanner } from '@pkgs/ui-root-client-ts/dismissible-top-banner';
import type { JSX } from 'solid-js';

export type AppUpdateRequiredBannerViewProps = {
  /** Shown while the product refuses this version and it is not dismissed. */
  readonly visible: boolean;
  readonly onDismiss: () => void;
  readonly onUpdate: () => void;
};

/**
 * Top banner asking the person to update when the product no longer accepts
 * this version, presentational. Nothing local is lost. `AppUpdateRequiredBanner`
 * follows the sync status and reloads.
 */
export function AppUpdateRequiredBannerView(
  props: AppUpdateRequiredBannerViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <DismissibleBanner
      visible={props.visible}
      onDismiss={() => props.onDismiss()}
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
      onActionClick={() => props.onUpdate()}
      dataSet={{ testid: Handles.appUpdateRequired }}
    />
  );
}

/** @jsxImportSource solid-js */

import { Trans, useLingui } from '@lingui/solid/macro';
import { DismissibleBanner } from '@pkgs/ui-root-client-ts/dismissible-top-banner';
import { type JSX, Show } from 'solid-js';

export type PwaUpdatePromptBannerViewProps = {
  /** Shown while a newer version is waiting to take over. */
  readonly visible: boolean;
  readonly onDismiss: () => void;
  readonly onReload: () => void;
};

/**
 * Top banner offering a reload when a newer version of the app has been
 * downloaded, presentational. `PwaUpdatePromptBanner` watches the service
 * worker and performs the reload.
 */
export function PwaUpdatePromptBannerView(
  props: PwaUpdatePromptBannerViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <Show when={props.visible}>
      <DismissibleBanner
        visible
        position="top"
        onDismiss={() => props.onDismiss()}
        title={<Trans>New version available — reload to update</Trans>}
        actionLabel={t`Reload`}
        onActionClick={() => props.onReload()}
        dataSet={{ testid: 'pwa-update-banner' }}
      />
    </Show>
  );
}

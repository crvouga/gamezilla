/** @jsxImportSource solid-js */

import { Trans, useLingui } from '@lingui/solid/macro';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { type JSX, Show } from 'solid-js';
import { BootLoadingShell } from './boot-loading-shell';

export type IdentityBootScreenViewProps = {
  /** `pending` while the local identity binds; `stuck` past its deadline. */
  readonly status: 'pending' | 'stuck';
  readonly onReload: () => void;
};

/**
 * Boot while this device's account loads, presentational: the boot loading
 * shell, or — once binding outlives its deadline — a failure with Reload.
 * `IdentityBootPending` owns the deadline.
 */
export function IdentityBootScreenView(
  props: IdentityBootScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <Show when={props.status === 'stuck'} fallback={<BootLoadingShell />}>
      <ErrorState
        title={<Trans>App failed to start</Trans>}
        body={
          <Trans>
            Your account could not be loaded. Check your connection and reload
            the app.
          </Trans>
        }
        retry={{ label: t`Reload app`, onClick: () => props.onReload() }}
      />
    </Show>
  );
}

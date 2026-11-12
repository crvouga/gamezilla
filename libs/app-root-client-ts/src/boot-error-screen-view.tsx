/** @jsxImportSource solid-js */

import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { BugIcon } from '@pkgs/ui-root-client-ts/icons';
import { MutationModal } from '@pkgs/ui-root-client-ts/mutation-modal';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { createSignal, type JSX, Match, Switch } from 'solid-js';

/**
 * Why the local database could not start: it hung past the watchdog
 * (`stuck`), another tab stopped sharing it (`otherTab`), or the open failed
 * outright (`failed`, told with its own message).
 */
export type LocalDatabaseBootErrorKind = 'stuck' | 'otherTab' | 'failed';

export type LocalDatabaseBootErrorScreenViewProps = {
  readonly kind: LocalDatabaseBootErrorKind;
  /** The open error's message, shown as the body when `kind` is `failed`. */
  readonly message: string;
  readonly onReload: () => void;
  readonly onReset: () => Promise<void>;
  /** Open a bug report; it runs apart from the app that failed to start. */
  readonly onReportBug: () => void;
};

function BootErrorTitle(props: {
  readonly kind: LocalDatabaseBootErrorKind;
}): JSX.Element {
  const productName = PRODUCT_NAME;
  return (
    <Switch fallback={<Trans>Could not start local database</Trans>}>
      <Match when={props.kind === 'otherTab'}>
        <Trans>{productName} is open in another tab</Trans>
      </Match>
      <Match when={props.kind === 'stuck'}>
        <Trans>App failed to start</Trans>
      </Match>
    </Switch>
  );
}

function BootErrorBody(
  props: Pick<LocalDatabaseBootErrorScreenViewProps, 'kind' | 'message'>
): JSX.Element {
  return (
    <Switch fallback={props.message}>
      <Match when={props.kind === 'stuck'}>
        <Trans>
          The app could not open its saved data. Close other tabs running this
          app, then reload. Reloading keeps your local data.
        </Trans>
      </Match>
      <Match when={props.kind === 'otherTab'}>
        <Trans>
          Another tab stopped sharing saved data. Close the other app tabs, then
          reload this one. Reloading keeps your local data.
        </Trans>
      </Match>
    </Switch>
  );
}

/**
 * Full-screen boot failure of this device's local database, presentational:
 * reload first, with a separately confirmed local reset when another tab
 * stopped sharing the database, and a way to report the bug.
 * `LocalDatabaseBootErrorScreen` classifies
 * the error and runs the recovery.
 */
export function LocalDatabaseBootErrorScreenView(
  props: LocalDatabaseBootErrorScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  const [confirmReset, setConfirmReset] = createSignal(false);
  return (
    <Surface tone="background" grow align="center" justify="center">
      <ErrorState
        dataSet={{ component: 'LocalDatabaseBootErrorScreen' }}
        title={<BootErrorTitle kind={props.kind} />}
        body={<BootErrorBody kind={props.kind} message={props.message} />}
        retry={{
          label: t`Reload app`,
          onClick: () => props.onReload(),
        }}
        secondary={
          props.kind === 'otherTab'
            ? {
                label: t`Reset local data`,
                onClick: () => setConfirmReset(true),
              }
            : undefined
        }
        details={
          <StackHorizontal justify="center">
            <Button
              title={t`Report a bug`}
              intent="neutral"
              variant="ghost"
              startIcon={<BugIcon size={16} />}
              onClick={() => props.onReportBug()}
            />
          </StackHorizontal>
        }
      />
      <MutationModal
        visible={confirmReset()}
        onClose={() => setConfirmReset(false)}
        title={t`Reset data on this device?`}
        message={t`Changes that have not synced and progress saved only on this device will be permanently lost. Data already synced to your account stays available. Try closing other app tabs and reloading first.`}
        operation={() => props.onReset()}
        submitLabel={t`Reset and reload`}
        variant="destructive"
        loadingLabel={t`Resetting local data…`}
        successTitle={t`Local data reset`}
        successBody={t`Reload the app to continue.`}
        errorTitle={t`Could not reset local data`}
      />
    </Surface>
  );
}

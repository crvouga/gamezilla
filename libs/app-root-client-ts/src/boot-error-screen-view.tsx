/** @jsxImportSource solid-js */

import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';
import { Trans, useLingui } from '@lingui/solid/macro';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import { type JSX, Match, Switch } from 'solid-js';

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
  /** Reload, or for `otherTab` reset local data and reload. */
  readonly onRetry: () => void;
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
  props: Omit<LocalDatabaseBootErrorScreenViewProps, 'onRetry'>
): JSX.Element {
  return (
    <Switch fallback={props.message}>
      <Match when={props.kind === 'stuck'}>
        <Trans>
          Local database did not become ready. Reload the app. If this keeps
          happening after an update, clear site data for this origin.
        </Trans>
      </Match>
      <Match when={props.kind === 'otherTab'}>
        <Trans>
          Another tab stopped sharing the local database. Reload this tab, or
          reset local data below (your account on the server is unchanged).
        </Trans>
      </Match>
    </Switch>
  );
}

/**
 * Full-screen boot failure of this device's local database, presentational:
 * what went wrong and the one way forward (reload, or reset local data when
 * another tab took the database). `LocalDatabaseBootErrorScreen` classifies
 * the error and runs the recovery.
 */
export function LocalDatabaseBootErrorScreenView(
  props: LocalDatabaseBootErrorScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <Surface tone="background" grow align="center" justify="center">
      <ErrorState
        dataSet={{ component: 'LocalDatabaseBootErrorScreen' }}
        title={<BootErrorTitle kind={props.kind} />}
        body={<BootErrorBody kind={props.kind} message={props.message} />}
        retry={{
          label:
            props.kind === 'otherTab'
              ? t`Reset local data and reload`
              : t`Reload app`,
          onClick: () => props.onRetry(),
        }}
      />
    </Surface>
  );
}

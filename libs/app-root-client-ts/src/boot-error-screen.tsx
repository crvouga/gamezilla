/** @jsxImportSource solid-js */

import { reloadApp } from '@libs/app-root-shared-ts/reload-app';
import { PRODUCT_NAME } from '@libs/product-identity-shared-ts/product-identity';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { useLogger } from '@pkgs/logger-client-ts/solid';
import { runWebOpfsRecoveryAndReload } from '@pkgs/sql-client-sqlite-web-client-ts/recover-in-process';
import { isLeaderLostError } from '@pkgs/sql-client-sqlite-web-shared-ts/rpc';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { Surface } from '@pkgs/ui-root-client-ts/surface';
import type { JSX } from 'solid-js';
import { OPFS_WIPE_CHANNEL } from './open-main-sql-client';

/** Synthetic error when open hangs past the UI watchdog (stale worker / SW). */
export const BOOT_STUCK_MESSAGE =
  'Local database did not become ready in time. This can happen after an app update when cached worker scripts are stale.';

export function isBootStuckError(error: Error): boolean {
  return error.message.includes('did not become ready in time');
}

function isMultiTabOwnerLostError(error: Error): boolean {
  return (
    isLeaderLostError(error) ||
    error.message.includes('E_LEADER_LOST') ||
    error.message.includes('Database owner')
  );
}

function bootErrorBody(error: Error): JSX.Element {
  if (isBootStuckError(error)) {
    return (
      <Trans>
        Local database did not become ready. Reload the app. If this keeps
        happening after an update, clear site data for this origin.
      </Trans>
    );
  }
  if (isMultiTabOwnerLostError(error)) {
    return (
      <Trans>
        Another tab stopped sharing the local database. Reload this tab, or
        reset local data below (your account on the server is unchanged).
      </Trans>
    );
  }
  return error.message;
}

export function LocalDatabaseBootErrorScreen(props: {
  readonly error: Error;
}): JSX.Element {
  const { t } = useLingui();
  const productName = PRODUCT_NAME;
  const timers = useTimers();
  const log = useLogger('local-database-boot');
  const canResetLocalData = () => isMultiTabOwnerLostError(props.error);

  const onRetry = (): void => {
    if (!canResetLocalData()) {
      reloadApp();
      return;
    }
    void runWebOpfsRecoveryAndReload({
      timers,
      wipeChannel: OPFS_WIPE_CHANNEL,
    }).catch((wipeError: unknown) => {
      log.error('local wipe failed', {
        error:
          wipeError instanceof Error ? wipeError.message : String(wipeError),
      });
    });
  };

  return (
    <Surface tone="background" grow align="center" justify="center">
      <ErrorState
        dataSet={{ component: 'LocalDatabaseBootErrorScreen' }}
        title={
          canResetLocalData() ? (
            <Trans>{productName} is open in another tab</Trans>
          ) : isBootStuckError(props.error) ? (
            <Trans>App failed to start</Trans>
          ) : (
            <Trans>Could not start local database</Trans>
          )
        }
        body={bootErrorBody(props.error)}
        retry={{
          label: canResetLocalData()
            ? t`Reset local data and reload`
            : t`Reload app`,
          onClick: onRetry,
        }}
      />
    </Surface>
  );
}

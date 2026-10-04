/** @jsxImportSource solid-js */

import { reloadApp } from '@libs/app-root-shared/reload-app';
import { Trans, useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock-client/solid';
import { useLogger } from '@pkgs/logger-client/solid';
import { runWebOpfsRecoveryAndReload } from '@pkgs/sql-client-sqlite-web-client/recover-in-process';
import { isLeaderLostError } from '@pkgs/sql-client-sqlite-web-shared/rpc';
import { ErrorState } from '@pkgs/ui-root-client/error-state';
import type { JSX } from 'solid-js';

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
  const timers = useTimers();
  const log = useLogger('local-database-boot');
  const canResetLocalData = () => isMultiTabOwnerLostError(props.error);

  const onRetry = (): void => {
    if (!canResetLocalData()) {
      reloadApp();
      return;
    }
    void runWebOpfsRecoveryAndReload({ timers }).catch((wipeError: unknown) => {
      log.error('local wipe failed', {
        error:
          wipeError instanceof Error ? wipeError.message : String(wipeError),
      });
    });
  };

  return (
    <div
      class="box items-center justify-center flex-1 bg-background"
      data-component="LocalDatabaseBootErrorScreen"
    >
      <ErrorState
        title={
          canResetLocalData() ? (
            <Trans>Gamezilla is open in another tab</Trans>
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
    </div>
  );
}

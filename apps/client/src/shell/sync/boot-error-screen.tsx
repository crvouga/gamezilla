/** @jsxImportSource solid-js */
import { Trans, useLingui } from '@lingui/solid/macro';
import { useTimers } from '@pkgs/clock/solid';
import { useLogger } from '@pkgs/logger/solid';
import {
  isLeaderLostError,
  runWebOpfsRecoveryAndReload,
} from '@pkgs/sql-client-sqlite-web';
import { Center, ErrorState } from '@pkgs/ui';
import type { JSX } from 'solid-js';

function isMultiTabOwnerLostError(error: Error): boolean {
  return (
    isLeaderLostError(error) ||
    error.message.includes('E_LEADER_LOST') ||
    error.message.includes('Database owner')
  );
}

function bootErrorBody(error: Error): JSX.Element {
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

function reloadWindow(): void {
  const loc = (globalThis as { location?: { reload(): void } }).location;
  loc?.reload();
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
      reloadWindow();
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
    <Center
      sx={{ flex: 1, background: 'background' }}
      dataSet={{ component: 'LocalDatabaseBootErrorScreen' }}
    >
      <ErrorState
        title={
          canResetLocalData() ? (
            <Trans>Gamezilla is open in another tab</Trans>
          ) : (
            <Trans>Could not start local database</Trans>
          )
        }
        body={bootErrorBody(props.error)}
        retry={{
          label: canResetLocalData()
            ? t`Reset local data and reload`
            : t`Try again`,
          onClick: onRetry,
        }}
      />
    </Center>
  );
}

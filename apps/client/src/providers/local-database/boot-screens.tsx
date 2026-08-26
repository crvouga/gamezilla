import { Trans, useLingui } from '@lingui/react/macro';
import { useTimers } from '@pkgs/clock';
import { WEB_OPFS_SOFT_RECOVERY_KEY } from '@pkgs/sql-client/sqlite/expo-sqlite-core';
import { isRecoverableExpoSqliteWebRuntimeError } from '@pkgs/sql-client/sqlite/expo-web-recovery';
import { isExpoSqliteWebSessionLockError } from '@pkgs/sql-client/sqlite/expo-web-session-lock';
import { RESET_DB_QUERY_PARAM } from '@pkgs/sql-client/sqlite/impl-expo-sqlite';
import {
  isLeaderLostError,
  runWebOpfsRecoveryAndReload,
} from '@pkgs/sql-client/sqlite/web';
import { Center, ErrorState } from '@pkgs/ui';
import type { ReactNode } from 'react';

import { ThemedBlankShell } from '../shell/blank-shell';

function isMultiTabOwnerLostError(error: Error): boolean {
  return (
    isLeaderLostError(error) ||
    error.message.includes('E_LEADER_LOST') ||
    error.message.includes('Database owner')
  );
}

function bootErrorBody(error: Error): ReactNode {
  if (isMultiTabOwnerLostError(error)) {
    return (
      <Trans>
        Another tab stopped sharing the local database. Reload this tab, or
        reset local data below (your account on the server is unchanged).
      </Trans>
    );
  }
  if (isRecoverableExpoSqliteWebRuntimeError(error)) {
    return (
      <Trans>
        Local storage hit a browser error. Reset local data below to start fresh
        — your account on the server is unchanged.
      </Trans>
    );
  }
  // Legacy exclusive session-lock path (pre multi-tab broker); keep for old builds.
  if (isExpoSqliteWebSessionLockError(error)) {
    return (
      <Trans>
        Another tab could not share the local database. Reload this tab, or
        reset local data below (your account on the server is unchanged).
      </Trans>
    );
  }
  return errorMessage(error);
}

function errorMessage(error: Error): string {
  return error.message;
}

/** Full-bleed themed shell so boot screens never flash the default canvas. */
function ThemedBootShell({ children }: { children: ReactNode }): ReactNode {
  return <Center sx={{ flex: 1, background: 'background' }}>{children}</Center>;
}

/** Blank canvas while splash still covers native — never a spinner. */
export function LocalDatabaseBootBlankScreen(): ReactNode {
  return <ThemedBlankShell />;
}

export function LocalDatabaseBootErrorScreen({
  error,
}: {
  error: Error;
}): ReactNode {
  const { t } = useLingui();
  const timers = useTimers();
  const isOwnerLost = isMultiTabOwnerLostError(error);
  const canResetLocalData =
    isOwnerLost ||
    isRecoverableExpoSqliteWebRuntimeError(error) ||
    isExpoSqliteWebSessionLockError(error);

  return (
    <ThemedBootShell>
      <ErrorState
        title={
          isOwnerLost || isExpoSqliteWebSessionLockError(error) ? (
            <Trans>Gamezilla is open in another tab</Trans>
          ) : canResetLocalData ? (
            <Trans>Local database needs a reset</Trans>
          ) : (
            <Trans>Could not start local database</Trans>
          )
        }
        body={bootErrorBody(error)}
        retry={{
          label: canResetLocalData
            ? t`Reset local data and reload`
            : t`Try again`,
          onPress: () => {
            if (typeof window === 'undefined') return;
            if (canResetLocalData) {
              try {
                sessionStorage.removeItem(WEB_OPFS_SOFT_RECOVERY_KEY);
              } catch {
                // ignore
              }
              const url = new URL(window.location.href);
              url.searchParams.delete(RESET_DB_QUERY_PARAM);
              const returnTo =
                url.pathname +
                (url.searchParams.toString()
                  ? `?${url.searchParams.toString()}`
                  : '') +
                url.hash;
              void runWebOpfsRecoveryAndReload({
                timers,
                returnTo: returnTo || '/',
              }).catch((wipeError: unknown) => {
                console.error(
                  '[LocalDatabaseBootErrorScreen] OPFS recovery failed',
                  wipeError
                );
              });
              return;
            }
            window.location.reload();
          },
        }}
      />
    </ThemedBootShell>
  );
}

export function isRecoverableLocalDatabaseBootError(error: Error): boolean {
  return (
    isMultiTabOwnerLostError(error) ||
    isRecoverableExpoSqliteWebRuntimeError(error) ||
    isExpoSqliteWebSessionLockError(error) ||
    errorMessage(error).includes(RESET_DB_QUERY_PARAM)
  );
}

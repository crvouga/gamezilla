import { RESET_DB_QUERY_PARAM } from '@pkgs/sql-client/impl-expo-sqlite';
import { isExpoSqliteWebSessionLockError } from '@pkgs/sql-client/expo-sqlite-web-session-lock';
import { isRecoverableExpoSqliteWebRuntimeError } from '@pkgs/sql-client/expo-sqlite-web-recovery';
import { ErrorState, LoadingState } from '@pkgs/ui';
import { Trans, useLingui } from '@lingui/react/macro';
import type { ReactNode } from 'react';

function bootErrorBody(error: Error): ReactNode {
  if (isExpoSqliteWebSessionLockError(error)) {
    return (
      <Trans>
        Gamezilla stores offline data in one browser tab at a time. Close every
        other tab of this site, then reload. If you want to use this tab
        instead, reset local data below (your account on the server is
        unchanged).
      </Trans>
    );
  }
  if (isRecoverableExpoSqliteWebRuntimeError(error)) {
    return (
      <Trans>
        Local storage hit a browser error. Reset local data below to start
        fresh — your account on the server is unchanged.
      </Trans>
    );
  }
  return errorMessage(error);
}

function errorMessage(error: Error): string {
  return error.message;
}

export function LocalDatabaseBootLoadingScreen(): ReactNode {
  return <LoadingState size="large" />;
}

export function LocalDatabaseBootErrorScreen({
  error,
}: {
  error: Error;
}): ReactNode {
  const { t } = useLingui();
  const isLockError = isExpoSqliteWebSessionLockError(error);
  const canResetLocalData =
    isLockError || isRecoverableExpoSqliteWebRuntimeError(error);

  return (
    <ErrorState
      title={
        isLockError ? (
          <Trans>Gamezilla is open in another tab</Trans>
        ) : canResetLocalData ? (
          <Trans>Local database needs a reset</Trans>
        ) : (
          <Trans>Could not start local database</Trans>
        )
      }
      body={bootErrorBody(error)}
      retry={{
        label: canResetLocalData ? t`Reset local data and reload` : t`Try again`,
        onPress: () => {
          if (typeof window === 'undefined') return;
          if (canResetLocalData) {
            const url = new URL(window.location.href);
            url.searchParams.set(RESET_DB_QUERY_PARAM, '1');
            window.location.replace(url.toString());
            return;
          }
          window.location.reload();
        },
      }}
    />
  );
}

export function isRecoverableLocalDatabaseBootError(error: Error): boolean {
  return (
    isExpoSqliteWebSessionLockError(error) ||
    isRecoverableExpoSqliteWebRuntimeError(error) ||
    errorMessage(error).includes(RESET_DB_QUERY_PARAM)
  );
}

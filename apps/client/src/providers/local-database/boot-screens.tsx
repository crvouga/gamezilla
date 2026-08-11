import { Trans, useLingui } from '@lingui/react/macro';
import { useTimers } from '@pkgs/clock';
import { isRecoverableExpoSqliteWebRuntimeError } from '@pkgs/sql-client/sqlite/expo-web-recovery';
import { isExpoSqliteWebSessionLockError } from '@pkgs/sql-client/sqlite/expo-web-session-lock';
import { RESET_DB_QUERY_PARAM } from '@pkgs/sql-client/sqlite/impl-expo-sqlite';
import { runWebOpfsRecoveryAndReload } from '@pkgs/sql-client/sqlite/web/opfs-recover';
import { ErrorState, LoadingState, useTheme } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { View } from 'react-native';

function bootErrorBody(error: Error): ReactNode {
  if (isExpoSqliteWebSessionLockError(error)) {
    return (
      <Trans>
        Another tab could not share the local database. Reload this tab, or
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
  return errorMessage(error);
}

function errorMessage(error: Error): string {
  return error.message;
}

/** Full-bleed themed shell so boot screens never flash the default canvas. */
function ThemedBootShell({ children }: { children: ReactNode }): ReactNode {
  const theme = useTheme();
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.colors.background,
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      {children}
    </View>
  );
}

export function LocalDatabaseBootLoadingScreen(props: {
  caption?: ReactNode;
}): ReactNode {
  return (
    <ThemedBootShell>
      <LoadingState
        size="large"
        {...(props.caption !== undefined ? { caption: props.caption } : {})}
      />
    </ThemedBootShell>
  );
}

export function LocalDatabaseBootErrorScreen({
  error,
}: {
  error: Error;
}): ReactNode {
  const { t } = useLingui();
  const timers = useTimers();
  const isLockError = isExpoSqliteWebSessionLockError(error);
  const canResetLocalData =
    isLockError || isRecoverableExpoSqliteWebRuntimeError(error);

  return (
    <ThemedBootShell>
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
          label: canResetLocalData
            ? t`Reset local data and reload`
            : t`Try again`,
          onPress: () => {
            if (typeof window === 'undefined') return;
            if (canResetLocalData) {
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
    isExpoSqliteWebSessionLockError(error) ||
    isRecoverableExpoSqliteWebRuntimeError(error) ||
    errorMessage(error).includes(RESET_DB_QUERY_PARAM)
  );
}

import { Trans, useLingui } from '@lingui/react/macro';
import { useTimers } from '@pkgs/clock';
import { isExpoSqliteWebSessionLockError } from '@pkgs/sql-client-sqlite/expo-web-session-lock';
import {
  isLeaderLostError,
  runWebOpfsRecoveryAndReload,
} from '@pkgs/sql-client-sqlite-web';
import { Center, ErrorState } from '@pkgs/ui-rn';
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
  const fallbackMessage = error.message;
  if (isMultiTabOwnerLostError(error)) {
    return (
      <Trans>
        Another tab stopped sharing the local database. Reload this tab, or
        reset local data below (your account on the server is unchanged).
      </Trans>
    );
  }
  // Legacy exclusive session-lock path (pre multi-tab broker).
  if (isExpoSqliteWebSessionLockError(error)) {
    return (
      <Trans>
        Another tab could not share the local database. Reload this tab, or
        reset local data below (your account on the server is unchanged).
      </Trans>
    );
  }
  return fallbackMessage;
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
    isOwnerLost || isExpoSqliteWebSessionLockError(error);

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
              void runWebOpfsRecoveryAndReload({ timers }).catch(
                (wipeError: unknown) => {
                  console.error(
                    '[LocalDatabaseBootErrorScreen] local wipe failed',
                    wipeError
                  );
                }
              );
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
    isMultiTabOwnerLostError(error) || isExpoSqliteWebSessionLockError(error)
  );
}

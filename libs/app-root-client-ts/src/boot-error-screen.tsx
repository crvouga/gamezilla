/** @jsxImportSource solid-js */

import { OPFS_WIPE_CHANNEL } from '@libs/app-env-client-ts/open-main-sql-client';
import { reloadApp } from '@libs/app-root-shared-ts/reload-app';
import { useTimers } from '@pkgs/clock-client-ts/solid';
import { requestBugReport } from '@pkgs/feedback-client-ts/request-bug-report';
import { useLogger } from '@pkgs/logger-client-ts/solid';
import { runWebOpfsRecoveryAndReload } from '@pkgs/sql-client-sqlite-web-client-ts/recover-in-process';
import { isLeaderLostError } from '@pkgs/sql-client-sqlite-web-shared-ts/rpc';
import type { JSX } from 'solid-js';
import {
  type LocalDatabaseBootErrorKind,
  LocalDatabaseBootErrorScreenView,
} from './boot-error-screen-view';

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

function bootErrorKind(error: Error): LocalDatabaseBootErrorKind {
  if (isMultiTabOwnerLostError(error)) return 'otherTab';
  if (isBootStuckError(error)) return 'stuck';
  return 'failed';
}

/** Wires `LocalDatabaseBootErrorScreenView` to reload and local recovery. */
export function LocalDatabaseBootErrorScreen(props: {
  readonly error: Error;
}): JSX.Element {
  const timers = useTimers();
  const log = useLogger('local-database-boot');
  const kind = (): LocalDatabaseBootErrorKind => bootErrorKind(props.error);

  const onReset = async (): Promise<void> => {
    try {
      await runWebOpfsRecoveryAndReload({
        timers,
        wipeChannel: OPFS_WIPE_CHANNEL,
      });
    } catch (error) {
      log.error('local wipe failed', {
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  };

  return (
    <LocalDatabaseBootErrorScreenView
      kind={kind()}
      message={props.error.message}
      onReload={reloadApp}
      onReset={onReset}
      onReportBug={() => requestBugReport()}
    />
  );
}

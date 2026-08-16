import { subscribeExpoSqliteWebFatalError } from '@pkgs/sql-client/sqlite/impl-expo-sqlite';
import { type ReactNode, useEffect, useState } from 'react';

import { useEmbeddedApp } from '../embedded-app-context';
import { LocalDatabaseBootErrorScreen } from './boot-screens';

/**
 * When expo-sqlite's OPFS worker hits an unrecoverable I/O error mid-session,
 * show the same reset-local-data screen used at boot instead of a blank crash.
 *
 * Embedded playground actors use AlaSQL — ignore global OPFS fatals from Main
 * (or a wedged SharedWorker) so Alice/Bob are not poisoned by that channel.
 */
export function SqliteRecoveryGate({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const embedded = useEmbeddedApp();
  const [fatalError, setFatalError] = useState<Error | null>(null);

  useEffect(() => {
    if (embedded) return;
    return subscribeExpoSqliteWebFatalError((error) => {
      setFatalError(error);
    });
  }, [embedded]);

  if (!embedded && fatalError !== null) {
    return <LocalDatabaseBootErrorScreen error={fatalError} />;
  }

  return children;
}

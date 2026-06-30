import { subscribeExpoSqliteWebFatalError } from '@pkgs/sql-client/impl-expo-sqlite';
import { useEffect, useState, type ReactNode } from 'react';

import { LocalDatabaseBootErrorScreen } from './local-database-boot-screen';

/**
 * When expo-sqlite's OPFS worker hits an unrecoverable I/O error mid-session,
 * show the same reset-local-data screen used at boot instead of a blank crash.
 */
export function SqliteWebRecoveryGate({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const [fatalError, setFatalError] = useState<Error | null>(null);

  useEffect(() => {
    return subscribeExpoSqliteWebFatalError((error) => {
      setFatalError(error);
    });
  }, []);

  if (fatalError !== null) {
    return <LocalDatabaseBootErrorScreen error={fatalError} />;
  }

  return children;
}

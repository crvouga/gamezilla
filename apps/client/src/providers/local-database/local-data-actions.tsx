import { PatchDbLocalDataActionsContext } from '@libs/auth/client/patch-db-local-data-actions-context';
import { useSecureStorage } from '@pkgs/secure-storage/interface';
import { useMemo, type ReactNode } from 'react';

import {
  clearLocalDatabaseAndReloadWithDeps,
  type PatchDbLocalDataDeps,
} from '../../patch-db/patch-db-local-data-impl';

export function PatchDbLocalDataActions({
  children,
}: {
  children: ReactNode;
}): ReactNode {
  const secure = useSecureStorage();

  const deps: PatchDbLocalDataDeps = useMemo(() => ({ secure }), [secure]);

  const actions = useMemo(
    () => ({
      clearLocalDatabaseAndReload: () =>
        clearLocalDatabaseAndReloadWithDeps(deps),
    }),
    [deps]
  );

  return (
    <PatchDbLocalDataActionsContext.Provider value={actions}>
      {children}
    </PatchDbLocalDataActionsContext.Provider>
  );
}

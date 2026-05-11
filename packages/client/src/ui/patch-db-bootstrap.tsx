import { ClientDataPlaneProvider } from '@gamezilla/client/runtime/client-data-plane-provider';
import type { ReactNode } from 'react';
import { Suspense } from 'react';

export {
  clearLocalDatabaseAndReload,
  removeLocalDataForAccount,
} from '@gamezilla/client/runtime/patch-db-runtime';

export function PatchBootstrap({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <ClientDataPlaneProvider>{children}</ClientDataPlaneProvider>
    </Suspense>
  );
}

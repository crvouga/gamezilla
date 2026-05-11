import { RuntimeBridge } from '@gamezilla/client/runtime/runtime-bridge';
import type { ReactNode } from 'react';
import { Suspense } from 'react';

export {
  clearLocalDatabaseAndReload,
  removeLocalDataForAccount,
} from '@gamezilla/client-runtime/patch-db-runtime';

export function PatchBootstrap({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={null}>
      <RuntimeBridge>{children}</RuntimeBridge>
    </Suspense>
  );
}

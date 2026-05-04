import { PatchDbStackContextProvider } from '@gamezilla/patch-db/react';
import { useAtom, useAtomValue } from 'jotai';
import type { ReactNode } from 'react';
import { entityBootstrapEffect, patchDbStackAtom } from './atoms';
import { hydrateAccountIdEffect, legacyPeerSeedCleanupEffect } from './hydrate';

export function RuntimeBridge({ children }: { children: ReactNode }) {
  useAtom(hydrateAccountIdEffect);
  useAtom(legacyPeerSeedCleanupEffect);
  useAtom(entityBootstrapEffect);
  const stack = useAtomValue(patchDbStackAtom);
  return (
    <PatchDbStackContextProvider value={stack}>
      {children}
    </PatchDbStackContextProvider>
  );
}

import {
  MutationClientProvider as SyncMutationClientProvider,
  useMutationClient,
} from '@pkgs/sync-engine/client';
import type { MutationRegistry } from '@pkgs/sync-engine/shared';
import { type ReactNode, useMemo } from 'react';

import { useRulesAuth } from './use-rules-auth';

export { useMutationClient };

/** Product wrapper: injects rules auth into the sync-engine mutation client. */
export function MutationClientProvider({
  children,
  registry,
}: {
  readonly children: ReactNode;
  readonly registry: MutationRegistry;
}): ReactNode {
  const auth = useRulesAuth();
  const env = useMemo(
    () => ({
      actorId: auth.userId,
      deviceId: auth.deviceId,
      accountId: auth.accountId,
      isAnon: auth.isAnon,
      now: () => new Date(),
    }),
    [auth.accountId, auth.deviceId, auth.isAnon, auth.userId]
  );
  const ids = useMemo(
    () => ({
      clientId: auth.deviceId,
    }),
    [auth.deviceId]
  );
  return (
    <SyncMutationClientProvider registry={registry} env={env} ids={ids}>
      {children}
    </SyncMutationClientProvider>
  );
}

import {
  createMutationClient,
  type MutationClient,
} from '@pkgs/mutations/client/create-mutation-client';
import type { MutationRegistry } from '@pkgs/mutations/core/types';
import { useSyncEngine } from '@pkgs/sync-engine/client/sync-engine-context';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { useRulesAuth } from './use-rules-auth';

const MutationClientContext = createContext<MutationClient | null>(null);
const sequenceByDevice = new Map<string, number>();

function nextSequence(deviceId: string): number {
  const next = (sequenceByDevice.get(deviceId) ?? 0) + 1;
  sequenceByDevice.set(deviceId, next);
  return next;
}

export function MutationClientProvider({
  children,
  registry,
}: {
  readonly children: ReactNode;
  readonly registry: MutationRegistry;
}): ReactNode {
  const engine = useSyncEngine();
  const auth = useRulesAuth();
  const client = useMemo(
    () =>
      createMutationClient({
        db: engine.db,
        registry,
        env: {
          actorId: auth.userId,
          deviceId: auth.deviceId,
          accountId: auth.accountId,
          isAnon: auth.isAnon,
          now: () => new Date(),
        },
        ids: {
          clientId: auth.deviceId,
          nextSeq: () => nextSequence(auth.deviceId),
        },
        connectivity: { isOnline: () => engine.status.getSnapshot().online },
      }),
    [auth, engine, registry]
  );
  return (
    <MutationClientContext.Provider value={client}>
      {children}
    </MutationClientContext.Provider>
  );
}

export function useMutationClient(): MutationClient {
  const client = useContext(MutationClientContext);
  if (client === null) {
    throw new Error(
      'useMutationClient: provider missing — mount inside MutationClientProvider'
    );
  }
  return client;
}

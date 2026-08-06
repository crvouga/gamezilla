import {
  createMutationClient,
  type MutationClient,
  type MutationClientIds,
  type MutationConnectivity,
} from '../mutations/client/create-mutation-client';
import type { MutationEnv, MutationRegistry } from '../mutations/core/types';
import { createContext, type ReactNode, useContext, useMemo } from 'react';

import { useSyncEngine } from './sync-engine-context';

const MutationClientContext = createContext<MutationClient | null>(null);

export type MutationClientProviderProps = {
  readonly children: ReactNode;
  readonly registry: MutationRegistry;
  readonly env: MutationEnv;
  readonly ids: MutationClientIds;
  readonly connectivity?: MutationConnectivity | undefined;
};

/**
 * Builds a {@link MutationClient} from the ambient sync engine + host-supplied
 * mutation env / client ids. Hosts typically wrap this with product auth hooks.
 */
export function MutationClientProvider({
  children,
  registry,
  env,
  ids,
  connectivity,
}: MutationClientProviderProps): ReactNode {
  const engine = useSyncEngine();
  const client = useMemo(
    () =>
      createMutationClient({
        db: engine.db,
        registry,
        env,
        ids,
        connectivity: connectivity ?? {
          isOnline: () => engine.status.getSnapshot().online,
        },
        onQueued: () => engine.wakeUploads(),
        onApplied: (event) => engine.fanoutMutation(event),
      }),
    [connectivity, engine, env, ids, registry]
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

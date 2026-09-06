/** @jsxImportSource solid-js */
import type { CreateId } from '@pkgs/uuid';
import { createContext, type ParentProps, untrack, useContext } from 'solid-js';

import {
  createMutationClient,
  type MutationClient,
  type MutationClientIds,
  type MutationConnectivity,
} from '../mutations/client/create-mutation-client';
import type { MutationEnv, MutationRegistry } from '../mutations/core/types';
import { withFrameworkMutations } from '../mutations/shared/with-framework-mutations';
import { useSyncEngineInstance } from './sync-engine-context';

const MutationClientContext = createContext<MutationClient>();

export type MutationClientProviderProps = {
  readonly registry: MutationRegistry;
  readonly env: MutationEnv;
  readonly ids: MutationClientIds;
  readonly createId: CreateId;
  readonly connectivity?: MutationConnectivity | undefined;
};

/**
 * Builds a {@link MutationClient} from the ambient sync engine + host-supplied
 * mutation env / client ids. The client is created once per provider mount
 * (props are configuration, not reactive inputs) so bootstrap `ensure*`
 * effects never re-fire on status churn.
 */
export function MutationClientProvider(
  props: ParentProps<MutationClientProviderProps>
) {
  const engine = useSyncEngineInstance();
  // Composition-root configuration: read once, not tracked.
  const config = untrack(() => ({
    registry: props.registry,
    env: props.env,
    ids: props.ids,
    createId: props.createId,
    connectivity: props.connectivity,
  }));
  const client = createMutationClient({
    db: engine.db,
    registry: withFrameworkMutations(config.registry),
    env: config.env,
    ids: config.ids,
    createId: config.createId,
    connectivity: config.connectivity ?? {
      isOnline: () => engine.status.getSnapshot().online,
    },
    onQueued: ({ mutation, args, capture }) => {
      engine.wakeUploads();
      engine.notifyLocalMutation(mutation, args, capture);
    },
  });
  return (
    <MutationClientContext.Provider value={client}>
      {props.children}
    </MutationClientContext.Provider>
  );
}

export function useMutationClient(): MutationClient {
  const client = useContext(MutationClientContext);
  if (client === undefined) {
    throw new Error(
      'useMutationClient: provider missing — mount inside MutationClientProvider'
    );
  }
  return client;
}

/** @jsxImportSource solid-js */

import type {
  MutationEnv,
  MutationRegistry,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import { withFrameworkMutations } from '@pkgs/sync-engine-shared-ts/with-framework-mutations';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import { onCleanup, type ParentProps, untrack } from 'solid-js';
import { awaitMutationVerdict } from './await-mutation-verdict';
import type {
  MutationClientIds,
  MutationConnectivity,
} from './create-mutation-client';
import { createMutationClient } from './create-mutation-client';
import { MutationClientContext } from './mutation-client-context';
import { useSyncEngineInstance } from './sync-engine-context';

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
 *
 * Imports `createMutationClient` (SQL AST / node-sql-parser). Keep this module
 * out of lightweight route graphs — consumers of {@link useMutationClient}
 * must import from `mutation-client-context`, not this file.
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
    awaitVerdict: (mutationId) => awaitMutationVerdict(engine, mutationId),
    onQueued: ({ mutation, args, capture }) => {
      engine.wakeUploads();
      engine.notifyLocalMutation(mutation, args, capture);
    },
  });
  // Keep the drain registered until queued work finishes. Component cleanup
  // can run before `Client.close()`, and unregistering immediately reopens the
  // closed-database race this provider is responsible for preventing.
  const unregisterMutationDrain = engine.registerMutationDrain(() =>
    client.drain()
  );
  onCleanup(() => {
    void client.drain().then(unregisterMutationDrain, unregisterMutationDrain);
  });
  return (
    <MutationClientContext.Provider value={client}>
      {props.children}
    </MutationClientContext.Provider>
  );
}

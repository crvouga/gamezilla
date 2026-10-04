import type { HarnessSlice } from '@libs/harness/slices';

import type { GameClientDefinition, GameDefinition } from '@libs/spaces-shared/game';
import { createSpacesClient } from '@libs/spaces-client/feature-client';
import { SPACES_FEATURE } from '@libs/spaces-shared/feature';
import { createSpacesServer } from '@libs/spaces-server/feature-server';
import { createInProcessRoomNode } from './in-process-room-node';
import { SPACES_HARNESS_ACTIONS } from './space-actions';

/**
 * Spaces in a harness, hosting exactly the games given: the product passes its
 * whole registry, the chess suites pass chess, a suite that never opens a
 * game passes none.
 */
export function spacesHarnessSlice(registry: {
  readonly games: readonly GameDefinition[];
  readonly clients: readonly GameClientDefinition[];
}): HarnessSlice {
  return {
    name: 'spaces',
    feature: SPACES_FEATURE,
    client: createSpacesClient({
      loadGameRegistry: () =>
        Promise.resolve({
          games: [...registry.games],
          clients: [...registry.clients],
        }),
    }),
    server: (deps) => createSpacesServer(deps.rooms),
    roomNode: (env, gateway) =>
      createInProcessRoomNode(env, { games: registry.games, gateway }),
    actions: SPACES_HARNESS_ACTIONS,
  };
}

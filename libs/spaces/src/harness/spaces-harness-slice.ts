import type { HarnessSlice } from '@libs/harness/slices';

import type { GameClientDefinition, GameDefinition } from '../public/game';
import { createSpacesClient } from '../root/client/feature-client';
import { SPACES_FEATURE } from '../root/feature';
import { SPACES_SERVER } from '../root/server/feature-server';
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
    server: () => SPACES_SERVER,
    roomNode: (env, gateway) =>
      createInProcessRoomNode(env, { games: registry.games, gateway }),
    actions: SPACES_HARNESS_ACTIONS,
  };
}

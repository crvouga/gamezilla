import type { SimSlice } from '@libs/sim-harness/slices';

import type { GameClientDefinition, GameDefinition } from '../public/game';
import { createSpacesClient } from '../root/client/feature-client';
import { SPACES_FEATURE } from '../root/feature';
import { SPACES_SERVER } from '../root/server/feature-server';
import { createInProcessRoomNode } from './in-process-room-node';
import { SPACES_SIM_ACTIONS } from './space-actions';
import { SPACES_WALK_ACTIONS } from './space-walk';

/**
 * Spaces in a sim, hosting exactly the games given: the product passes its
 * whole registry, the chess suites pass chess, a suite that never opens a
 * game passes none.
 */
export function spacesSimSlice(registry: {
  readonly games: readonly GameDefinition[];
  readonly clients: readonly GameClientDefinition[];
}): SimSlice {
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
    roomNode: (env) => createInProcessRoomNode(env, registry.games),
    actions: [...SPACES_SIM_ACTIONS, ...SPACES_WALK_ACTIONS],
  };
}

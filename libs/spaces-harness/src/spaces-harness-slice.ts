import type { HarnessSlice } from '@libs/harness/slices';
import { createSpacesClient } from '@libs/spaces-client/sub-client';
import type { SpaceBlockRelation } from '@libs/spaces-server/space-restrictions';
import { createSpacesServer } from '@libs/spaces-server/sub-server';
import type {
  GameClientDefinition,
  GameDefinition,
} from '@libs/spaces-shared/game';
import { SPACES_SUB } from '@libs/spaces-shared/sub';
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
  /** The friends context's block relation, when friends is composed too. */
  readonly blocks?: SpaceBlockRelation;
}): HarnessSlice {
  return {
    name: 'spaces',
    sub: SPACES_SUB,
    client: createSpacesClient({
      registry: {
        games: [...registry.games],
        clients: [...registry.clients],
      },
    }),
    server: (deps) => createSpacesServer(deps.rooms, registry.blocks ?? null),
    roomNode: (env, gateway) =>
      createInProcessRoomNode(env, { games: registry.games, gateway }),
    actions: SPACES_HARNESS_ACTIONS,
  };
}

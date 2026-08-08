import { mutationRegistry, queryRegistry } from '@pkgs/sync-engine/shared';

import { addShape, removeShape, reorderShapes } from './mutations';
import { shapesWorldQuery } from './queries';

/** Product-only registry; createLocalSyncEngine / createSyncApp merge framework mutations. */
export const shapesMutationRegistry = mutationRegistry([
  addShape,
  removeShape,
  reorderShapes,
]);

export const shapesQueryRegistry = queryRegistry([shapesWorldQuery]);

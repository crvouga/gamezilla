import {
  mutationRegistry,
  queryRegistry,
  withFrameworkMutations,
} from '@pkgs/sync-engine/shared';

import { addShape, removeShape, reorderShapes } from './mutations';
import { shapesWorldQuery } from './queries';

export const shapesMutationRegistry = withFrameworkMutations(
  mutationRegistry([addShape, removeShape, reorderShapes])
);

export const shapesQueryRegistry = queryRegistry([shapesWorldQuery]);

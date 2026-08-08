export {
  type LiveShape,
  readLiveShapes,
  shapesMatch,
} from './assert';
export { shapesLocalSchema } from './client/local-schema';
export { shapesDomainPack } from './domain-pack';
export {
  addShape,
  removeShape,
  reorderShapes,
} from './shared/mutations';
export { shapesWorldQuery } from './shared/queries';
export {
  shapesMutationRegistry,
  shapesQueryRegistry,
} from './shared/registries';
export {
  SHAPE_KINDS,
  SHAPES_APP_TABLES,
  type ShapeKind,
  shapesAppSchema,
} from './shared/schema';
export { SHAPES_WORLD_TOPIC } from './shared/topics';

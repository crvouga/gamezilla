/**
 * Public surface for patch-db's declarative schema layer.
 *
 * Apps and feature packages should import from this barrel:
 *
 * ```ts
 * import {
 *   defineEntitySchema,
 *   createEntitySchemaRegistry,
 *   type EntitySchema,
 *   type FrozenEntitySchemaRegistry,
 * } from '@pkgs/patch-db/schema';
 * ```
 */
export {
  defineEntitySchema,
  type CompositeIndexFieldSpec,
  type CompositeIndexSpec,
  type DefineEntitySchemaArgs,
  type EntitySchema,
  type EntitySchemaIndex,
  type EntitySchemaIndexDirection,
  type EntitySchemaIndexField,
  type EntitySchemaWherePredicate,
} from './entity-schema';
export {
  createEntitySchemaRegistry,
  EMPTY_FROZEN_ENTITY_SCHEMA_REGISTRY,
  EntitySchemaRegistry,
  type FrozenEntitySchemaRegistry,
} from './entity-schema-registry';
export {
  assertQueryAgainstSchema,
  type AssertQueryAgainstSchemaOptions,
} from './assert-query';

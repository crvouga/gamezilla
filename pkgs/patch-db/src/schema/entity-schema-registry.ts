/**
 * Dynamic registration container for {@link EntitySchema} values.
 *
 * The registry is the only product-agnostic surface in `@pkgs/patch-db` for
 * "what entity types does this app support?". Apps build a mutable registry
 * at boot (registering schemas from feature packages), then call
 * {@link EntitySchemaRegistry.freeze} once everything is wired. The
 * resulting {@link FrozenEntitySchemaRegistry} is injected into the engine
 * (`PatchDbImplPostgres`), the deploy-time reconciler, and the runtime
 * query asserts — all three share the same source of truth.
 *
 * @pkgs/patch-db never instantiates a populated registry; that is always the
 * app's responsibility.
 */
import { assert } from '@pkgs/assert';
import type { PatchEntityType } from '../entity-key';
import type { EntitySchema } from './entity-schema';

/**
 * Immutable view of a registered schema set. Returned by
 * {@link EntitySchemaRegistry.freeze}. Engines accept only the frozen view
 * so they can rely on the registry never changing after construction.
 */
export interface FrozenEntitySchemaRegistry {
  get(entityType: PatchEntityType): EntitySchema | null;
  has(entityType: PatchEntityType): boolean;
  values(): IterableIterator<EntitySchema>;
  readonly size: number;
}

function freezeSchemas(
  schemas: ReadonlyMap<PatchEntityType, EntitySchema>
): FrozenEntitySchemaRegistry {
  const snapshot = new Map(schemas);
  return Object.freeze({
    get: (entityType: PatchEntityType) => snapshot.get(entityType) ?? null,
    has: (entityType: PatchEntityType) => snapshot.has(entityType),
    values: () => snapshot.values(),
    get size(): number {
      return snapshot.size;
    },
  });
}

/**
 * Mutable builder. Crashes on duplicate `entityType` registration so a
 * mis-composed app fails loudly at boot rather than silently picking one
 * schema. Crashes on `register` after `freeze` so a frozen registry truly
 * is frozen.
 */
export class EntitySchemaRegistry {
  private readonly schemas = new Map<PatchEntityType, EntitySchema>();
  private frozen = false;

  register(schema: EntitySchema): this {
    assert.ok(
      !this.frozen,
      'EntitySchemaRegistry.register: cannot register after freeze()'
    );
    assert.ok(
      !this.schemas.has(schema.entityType),
      'EntitySchemaRegistry.register: duplicate entity type',
      { entityType: schema.entityType }
    );
    this.schemas.set(schema.entityType, schema);
    return this;
  }

  registerAll(schemas: Iterable<EntitySchema>): this {
    for (const s of schemas) this.register(s);
    return this;
  }

  freeze(): FrozenEntitySchemaRegistry {
    this.frozen = true;
    return freezeSchemas(this.schemas);
  }
}

export function createEntitySchemaRegistry(): EntitySchemaRegistry {
  return new EntitySchemaRegistry();
}

/**
 * Empty frozen registry — useful for engines / call sites that need to
 * accept "no schemas declared yet" without special-casing `null`. Reads of
 * undeclared entity types will then crash via tiger asserts as usual.
 */
export const EMPTY_FROZEN_ENTITY_SCHEMA_REGISTRY: FrozenEntitySchemaRegistry =
  freezeSchemas(new Map());

/**
 * Bridge from the new declarative schema layer to the legacy
 * {@link PatchDbIndexSpec} reconciler. Lets the existing Postgres index
 * dialect keep working while feature packages migrate to `.indexed()` tags
 * and `defineEntitySchema(...)`.
 *
 * Phase 2 of the patch-db overhaul replaces the legacy index reconciler
 * with one that targets generated columns on per-entity-type partitions;
 * this bridge will be deleted at that point.
 */
import type { PatchDbIndexSpec } from '../indexes/index-spec';
import type { EntitySchema } from './entity-schema';
import type { FrozenEntitySchemaRegistry } from './entity-schema-registry';

export function entitySchemaToIndexSpecs(
  schema: EntitySchema
): readonly PatchDbIndexSpec[] {
  const out: PatchDbIndexSpec[] = [];
  for (const index of schema.indexes) {
    if (index.fields.length === 0) continue;
    out.push({
      name: index.localName,
      entityType: schema.entityType,
      fields: index.fields.map((f) => {
        const tag = schema.attributes.get(f.attributeKey);
        return {
          kind: 'attribute',
          attribute: f.attributeKey,
          dataType: tag?.dataType ?? null,
        };
      }),
    });
  }
  return out;
}

export function registryToIndexSpecs(
  registry: FrozenEntitySchemaRegistry
): readonly PatchDbIndexSpec[] {
  const out: PatchDbIndexSpec[] = [];
  for (const schema of registry.values()) {
    out.push(...entitySchemaToIndexSpecs(schema));
  }
  return out;
}

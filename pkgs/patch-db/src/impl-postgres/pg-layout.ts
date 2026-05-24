/**
 * Pure derivation of the desired Postgres layout for a frozen entity-schema
 * registry. Consumed by the reconciler ({@link ./pg-reconcile}) which diffs
 * this against {@link ./pg-introspect.introspectPgLayout} and emits the
 * smallest DDL needed to converge.
 *
 * "Desired layout" = every Postgres object the reconciler owns:
 *   - one `snapshots__<slug>` standalone table per registered entity type
 *     (NOT a partition of anything; carries its own typed columns only);
 *   - one `gc_<slug>__<attr>` generated column per `.indexed()` scalar tag,
 *     declared ONLY on its owning per-entity table;
 *   - one `gc_<slug>__<attr>_idx` btree per generated column on the same
 *     per-entity table;
 *   - one `pdb_cidx_<slug>__<localName>` btree per declared composite
 *     index, on the same per-entity table;
 *   - one `pdb_gin_<slug>__attrs` GIN on `attributes` per per-entity table;
 *   - one `snapshots` VIEW that `UNION ALL`s every per-entity table so
 *     cross-entity reads (subqueries, bare reads, sim wipes) keep working.
 *
 * Composite indexes resolve through the generated-column layer: every
 * composite-field attribute must be `.indexed()` (so it has a typed gen
 * column) and indexable on a typed column (rejects array/json/binary).
 * The check fires at boot — a misconfigured composite crashes
 * `defineEntitySchema`-time + registry-build time, not at SQL time.
 */
import { assert } from '@pkgs/assert';
import type { Keyword } from '@pkgs/keyword';
import type { PatchEntityType } from '../entity-key';
import type {
  EntitySchema,
  EntitySchemaIndex,
  EntitySchemaIndexDirection,
} from '../schema/entity-schema';
import type { FrozenEntitySchemaRegistry } from '../schema/entity-schema-registry';
import {
  buildPartitionInfo,
  compositeIndexNameFor,
  type GeneratedColumnSpec,
  ginIndexNameFor,
  partitionTableName,
  singleColumnIndexNameFor,
} from './partitioning';

/** One column reference inside a composite-index spec, resolved to its
 * generated-column identifier. */
export type DesiredCompositeColumn = {
  readonly columnName: string;
  readonly direction: EntitySchemaIndexDirection;
};

/** Predicate compiled to a `<col> IS NOT NULL` fragment. Matches the schema's
 * `attributeIsNotNull` kind (the only kind today). */
export type DesiredCompositePredicate = {
  readonly columnName: string;
};

export type DesiredCompositeIndex = {
  readonly indexName: string;
  readonly localName: string;
  readonly columns: readonly DesiredCompositeColumn[];
  readonly unique: boolean;
  readonly wherePredicates: readonly DesiredCompositePredicate[];
};

export type DesiredSingleIndex = {
  readonly indexName: string;
  readonly columnName: string;
};

/** Desired shape of one per-entity standalone table. */
export type DesiredEntityTable = {
  readonly entityType: PatchEntityType;
  readonly tableName: string;
  /** GIN index name on `attributes` for this table. The reconciler owns
   *  it (no longer a parent-level base-DDL object). */
  readonly ginIndexName: string;
  readonly generatedColumns: ReadonlyMap<string, GeneratedColumnSpec>;
  readonly singleIndexes: ReadonlyMap<string, DesiredSingleIndex>;
  readonly compositeIndexes: ReadonlyMap<string, DesiredCompositeIndex>;
};

export type DesiredPgLayout = {
  /** Keyed by `snapshots__<slug>` table name. */
  readonly tables: ReadonlyMap<string, DesiredEntityTable>;
};

function buildSingleIndex(
  spec: GeneratedColumnSpec
): DesiredSingleIndex {
  return {
    indexName: singleColumnIndexNameFor(spec.columnName),
    columnName: spec.columnName,
  };
}

type CompositeResolveCtx = {
  readonly entityType: PatchEntityType;
  readonly localName: string;
  readonly columnsByAttribute: ReadonlyMap<Keyword, GeneratedColumnSpec>;
};

function resolveCompositeColumn(
  ctx: CompositeResolveCtx,
  attributeKey: Keyword,
  direction: EntitySchemaIndexDirection
): DesiredCompositeColumn {
  const gen = ctx.columnsByAttribute.get(attributeKey);
  assert.defined(
    gen,
    'composite index references an attribute that has no generated column (mark it `.indexed()` and use a scalar data type)',
    { entityType: ctx.entityType, compositeName: ctx.localName, attribute: attributeKey }
  );
  return { columnName: gen.columnName, direction };
}

function resolveCompositePredicate(
  ctx: CompositeResolveCtx,
  attributeKey: Keyword
): DesiredCompositePredicate {
  const gen = ctx.columnsByAttribute.get(attributeKey);
  assert.defined(
    gen,
    'composite index `where` predicate references an attribute with no generated column (mark it `.indexed()` and use a scalar data type)',
    { entityType: ctx.entityType, compositeName: ctx.localName, attribute: attributeKey }
  );
  return { columnName: gen.columnName };
}

function buildDesiredCompositeIndex(
  schema: EntitySchema,
  index: EntitySchemaIndex,
  columnsByAttribute: ReadonlyMap<Keyword, GeneratedColumnSpec>
): DesiredCompositeIndex {
  assert.ok(
    index.fields.length > 0,
    'composite index must declare at least one field',
    { entityType: schema.entityType, localName: index.localName }
  );
  const ctx: CompositeResolveCtx = {
    entityType: schema.entityType,
    localName: index.localName,
    columnsByAttribute,
  };
  const columns = index.fields.map((f) =>
    resolveCompositeColumn(ctx, f.attributeKey, f.direction)
  );
  const wherePredicates = index.where.map((w) =>
    resolveCompositePredicate(ctx, w.attributeKey)
  );
  return {
    indexName: compositeIndexNameFor(schema.entityType, index.localName),
    localName: index.localName,
    columns,
    unique: index.unique,
    wherePredicates,
  };
}

function buildDesiredEntityTable(schema: EntitySchema): DesiredEntityTable {
  const info = buildPartitionInfo(schema);
  const generatedColumns = new Map<string, GeneratedColumnSpec>();
  for (const spec of info.columnsByAttribute.values()) {
    generatedColumns.set(spec.columnName, spec);
  }
  const singleIndexes = new Map<string, DesiredSingleIndex>();
  for (const spec of generatedColumns.values()) {
    const single = buildSingleIndex(spec);
    singleIndexes.set(single.indexName, single);
  }
  const compositeIndexes = new Map<string, DesiredCompositeIndex>();
  for (const index of schema.indexes) {
    if (index.singleField) continue;
    const composite = buildDesiredCompositeIndex(
      schema,
      index,
      info.columnsByAttribute
    );
    assert.ok(
      !compositeIndexes.has(composite.indexName),
      'two composite indexes slug to the same per-entity btree name',
      {
        entityType: schema.entityType,
        localName: index.localName,
        indexName: composite.indexName,
      }
    );
    compositeIndexes.set(composite.indexName, composite);
  }
  return Object.freeze({
    entityType: schema.entityType,
    tableName: partitionTableName(schema.entityType),
    ginIndexName: ginIndexNameFor(schema.entityType),
    generatedColumns,
    singleIndexes,
    compositeIndexes,
  });
}

/**
 * Pure: turns a frozen schema registry into the Postgres layout the
 * reconciler should converge toward. Independent of any DB connection;
 * fully unit-testable.
 */
export function computeDesiredPgLayout(
  registry: FrozenEntitySchemaRegistry
): DesiredPgLayout {
  const tables = new Map<string, DesiredEntityTable>();
  for (const schema of registry.values()) {
    const table = buildDesiredEntityTable(schema);
    assert.ok(
      !tables.has(table.tableName),
      'two entity types slug to the same per-entity table name',
      {
        tableName: table.tableName,
        entityType: schema.entityType,
      }
    );
    tables.set(table.tableName, table);
  }
  return Object.freeze({ tables });
}

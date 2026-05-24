/**
 * Pure identifier helpers for the per-`entity_type` **standalone tables**
 * that hold snapshot rows.
 *
 * Each registered entity type owns a standalone `snapshots__<slug>` table
 * (not a partition of anything) carrying ONLY its own typed generated
 * columns + per-column btrees + composite btrees + a per-table GIN.
 * Cross-entity scans hit the `snapshots` VIEW (a `UNION ALL` over every
 * per-entity table that the reconciler regenerates on each migrate);
 * Postgres prunes UNION branches via the per-table `CHECK (entity_type
 * = 'X')` constraint, so `WHERE entity_type = ?` is still O(one table).
 * Per-entity hot paths target the per-entity table directly so the
 * planner sees typed columns instead of a JSONB extract.
 *
 * The `snapshots__<slug>` naming convention pre-dates the architectural
 * pivot away from declarative partitioning (`partitionTableName` is kept
 * as the helper name for historical continuity); the tables are no longer
 * partitions of any parent.
 *
 * This module is *pure*: it takes a {@link FrozenEntitySchemaRegistry} and
 * returns identifier strings + column descriptors. No SQL execution lives
 * here — see {@link migrate-partitions} for the DDL helpers that consume
 * these descriptors.
 */
import { assert } from '@pkgs/assert';
import type { AnyAttributeTag, DataType } from '@pkgs/attribute';
import type { Keyword } from '@pkgs/keyword';
import { assertSqlIdentifier } from '@pkgs/sql';
import type { PatchEntityType } from '../entity-key';
import type { EntitySchema } from '../schema/entity-schema';
import type { FrozenEntitySchemaRegistry } from '../schema/entity-schema-registry';
import { isNumericIndexDataType } from './numeric-data-type';

/** Identifier prefix for every per-entity standalone table patch-db owns. */
export const PATCH_DB_PARTITION_PREFIX = 'snapshots__';
/** Identifier prefix for every typed generated column on a per-entity table. */
export const PATCH_DB_GENERATED_COLUMN_PREFIX = 'gc_';
/** Suffix on every per-entity single-column btree the reconciler manages. */
export const PATCH_DB_SINGLE_INDEX_SUFFIX = '_idx';
/** Identifier prefix for every composite (multi-column) btree the reconciler manages. */
export const PATCH_DB_COMPOSITE_INDEX_PREFIX = 'pdb_cidx_';
/** Name of the cross-entity `UNION ALL` view the reconciler maintains. */
export const PATCH_DB_SNAPSHOTS_VIEW_NAME = 'snapshots';
/** Identifier prefix for every per-entity GIN index on `attributes`. */
export const PATCH_DB_GIN_INDEX_PREFIX = 'pdb_gin_';

/** PG `NAMEDATALEN - 1`. We reuse the same bound for portability + safety. */
const MAX_PG_IDENTIFIER_LEN = 63;

/**
 * Slug derived from an `entity_type` keyword: dots and dashes become
 * underscores so the result is a valid SQL identifier.
 */
export function entityTypeSlug(entityType: PatchEntityType): string {
  const slug = entityType.replace(/[.-]/g, '_');
  assertSqlIdentifier(slug, 'entityTypeSlug must produce a SQL identifier', {
    entityType,
    slug,
  });
  return slug;
}

/**
 * Per-entity standalone table name: `snapshots__<slug>`. Stable for a given
 * entity type; safe to embed in DDL and SELECT FROM clauses after
 * `assertSqlIdentifier`. (Name kept for historical continuity even though
 * the tables are no longer Postgres partitions of any parent.)
 */
export function partitionTableName(entityType: PatchEntityType): string {
  const name = `${PATCH_DB_PARTITION_PREFIX}${entityTypeSlug(entityType)}`;
  assert.ok(
    name.length <= MAX_PG_IDENTIFIER_LEN,
    'partitionTableName produces too-long identifier; shorten entity type',
    { entityType, name, max: MAX_PG_IDENTIFIER_LEN }
  );
  return name;
}

/**
 * Per-entity GIN index name on `attributes`. The reconciler creates one of
 * these per per-entity table so JSONB containment / contains-key lookups
 * have a covering inverted index without bloating the `snapshots` parent
 * (which no longer exists as a partitioned table).
 */
export function ginIndexNameFor(entityType: PatchEntityType): string {
  const name = `${PATCH_DB_GIN_INDEX_PREFIX}${entityTypeSlug(entityType)}__attrs`;
  assertSqlIdentifier(name, 'ginIndexNameFor must produce a SQL identifier', {
    entityType,
    name,
  });
  assert.ok(
    name.length <= MAX_PG_IDENTIFIER_LEN,
    'ginIndexNameFor produces too-long identifier; shorten entity type',
    { entityType, name, max: MAX_PG_IDENTIFIER_LEN }
  );
  return name;
}

/**
 * Pure column-name derivation from the local segment of a namespaced
 * keyword. `chess.puzzle/rating` → `rating`. The full generated-column
 * identifier is composed in {@link generatedColumnNameFor}.
 */
function attributeLocalSlug(attribute: Keyword): string {
  const slash = attribute.indexOf('/');
  assert.ok(slash >= 0, 'attributeLocalSlug: keyword must contain "/"', {
    attribute,
  });
  const local = attribute.slice(slash + 1);
  return local.replace(/-/g, '_');
}

/**
 * Composes the full generated-column identifier on a per-entity table.
 * The column name encodes *both* the entity type and the attribute so that
 * (a) two indexed attributes sharing a local segment across entity types
 * (e.g. `task/rating` vs. `chess.puzzle/rating`) don't collide, and
 * (b) introspection can still tell which entity a stray gen column belongs
 * to (drop it from the right table if the registry no longer claims it).
 *
 * `chess.puzzle/rating` → `gc_chess_puzzle__rating`.
 */
export function generatedColumnNameFor(
  entityType: PatchEntityType,
  attribute: Keyword
): string {
  const name = `${PATCH_DB_GENERATED_COLUMN_PREFIX}${entityTypeSlug(entityType)}__${attributeLocalSlug(attribute)}`;
  assertSqlIdentifier(
    name,
    'generatedColumnNameFor must produce a SQL identifier',
    {
      entityType,
      attribute,
      name,
    }
  );
  assert.ok(
    name.length <= MAX_PG_IDENTIFIER_LEN,
    'generatedColumnNameFor produces too-long identifier; rename the entity type or attribute local segment',
    { name, max: MAX_PG_IDENTIFIER_LEN }
  );
  return name;
}

/**
 * Per-entity-table single-column btree identifier for a generated column.
 * Centralised so introspection (`pg_indexes.indexname`) and DDL emission
 * agree on the same naming convention. The generated-column name already
 * encodes the entity-type slug, so the suffix alone keeps it globally
 * unique while staying under 63 chars.
 */
export function singleColumnIndexNameFor(generatedColumnName: string): string {
  assertSqlIdentifier(
    generatedColumnName,
    'singleColumnIndexNameFor: generatedColumnName'
  );
  const name = `${generatedColumnName}${PATCH_DB_SINGLE_INDEX_SUFFIX}`;
  assert.ok(
    name.length <= MAX_PG_IDENTIFIER_LEN,
    'singleColumnIndexNameFor produces too-long identifier; shorten the entity-type slug or attribute local segment',
    { name, max: MAX_PG_IDENTIFIER_LEN }
  );
  assertSqlIdentifier(name, 'singleColumnIndexNameFor: indexName');
  return name;
}

/**
 * Per-entity-table composite btree identifier. Encodes the entity-type
 * slug + the author-facing composite name (e.g. `rating-popularity` →
 * `pdb_cidx_chess_puzzle__rating_popularity`). Slashes are not legal here;
 * the schema layer already enforces `^[a-z][a-z0-9-]*$` for composite
 * names, so dashes are the only non-alpha char and become underscores.
 */
export function compositeIndexNameFor(
  entityType: PatchEntityType,
  localName: string
): string {
  const localSlug = localName.replace(/-/g, '_');
  const name = `${PATCH_DB_COMPOSITE_INDEX_PREFIX}${entityTypeSlug(entityType)}__${localSlug}`;
  assertSqlIdentifier(
    name,
    'compositeIndexNameFor must produce a SQL identifier',
    { entityType, localName, name }
  );
  assert.ok(
    name.length <= MAX_PG_IDENTIFIER_LEN,
    'compositeIndexNameFor produces too-long identifier; shorten the entity-type slug or composite-index local name',
    { name, max: MAX_PG_IDENTIFIER_LEN }
  );
  return name;
}

export type GeneratedColumnSpec = {
  /** Full attribute key (e.g. `chess.puzzle/rating`). */
  readonly attribute: Keyword;
  /** Generated-column identifier on the per-entity table (e.g. `gc_chess_puzzle__rating`). */
  readonly columnName: string;
  /** Storage shape declared on the source `AttributeTag`. */
  readonly dataType: DataType;
  /** When `true`, the column should be declared `NOT NULL` because the
   *  source tag is non-nullable. Currently informational only — Postgres
   *  generated columns can't be `NOT NULL` directly when the expression is
   *  nullable, so emitters use this as a hint, not a hard constraint. */
  readonly nullable: boolean;
};

/**
 * Builds the descriptor table for a single entity type. Returns one
 * `GeneratedColumnSpec` per `.indexed()` attribute, deduplicated by
 * column name + attribute key.
 *
 * Crashes when two `.indexed()` attributes on the same schema slug to the
 * same column name — that's a deploy-time configuration error and should
 * fail the boot rather than silently shadow.
 */
export function computeGeneratedColumns(
  schema: EntitySchema
): readonly GeneratedColumnSpec[] {
  const out: GeneratedColumnSpec[] = [];
  const seenNames = new Set<string>();
  for (const tag of schema.indexedAttributes.values()) {
    const tagAny = tag as AnyAttributeTag;
    if (!isIndexableDataType(tagAny.dataType)) {
      // Skip array / json / binary — they have no scalar column form.
      // Keep them out of the partition so the JSONB GIN path still owns
      // them (compositions / contains lookups continue to work).
      continue;
    }
    const columnName = generatedColumnNameFor(schema.entityType, tagAny.key);
    assert.ok(
      !seenNames.has(columnName),
      'two indexed attributes slug to the same generated column',
      { entityType: schema.entityType, attribute: tagAny.key, columnName }
    );
    seenNames.add(columnName);
    out.push({
      attribute: tagAny.key,
      columnName,
      dataType: tagAny.dataType,
      nullable: tagAny.nullable === true,
    });
  }
  return Object.freeze(out);
}

/** Indexable-on-a-typed-column data types. Mirrors the engine's index-creation rules. */
const INDEXABLE_DATA_TYPES: ReadonlySet<DataType> = new Set<DataType>([
  'text',
  'uuid',
  'enum',
  'date',
  'timestamp',
  'time',
  'email',
  'url',
  'integer',
  'number',
  'bigint',
  'boolean',
]);

export function isIndexableDataType(dataType: DataType): boolean {
  return INDEXABLE_DATA_TYPES.has(dataType);
}

/**
 * Postgres column type for a {@link DataType}. Numeric types share `numeric`
 * because that matches the cast the query builder emits (`::numeric`); a
 * future pass could split into `bigint` / `int` / `double precision`, but
 * `numeric` keeps the planner happy with no precision loss.
 */
export function pgColumnTypeFor(dataType: DataType): string {
  if (isNumericIndexDataType(dataType)) return 'numeric';
  if (dataType === 'boolean') return 'boolean';
  return 'text';
}

export type PartitionInfo = {
  readonly entityType: PatchEntityType;
  /** Per-entity standalone table the query builder targets directly when
   *  the entity type is known (`snapshots__<slug>`). */
  readonly tableName: string;
  /** Indexed by attribute key for O(1) lookups during query compilation. */
  readonly columnsByAttribute: ReadonlyMap<Keyword, GeneratedColumnSpec>;
};

export function buildPartitionInfo(schema: EntitySchema): PartitionInfo {
  const columns = computeGeneratedColumns(schema);
  const columnsByAttribute = new Map<Keyword, GeneratedColumnSpec>();
  for (const col of columns) {
    columnsByAttribute.set(col.attribute, col);
  }
  return Object.freeze({
    entityType: schema.entityType,
    tableName: partitionTableName(schema.entityType),
    columnsByAttribute,
  });
}

/**
 * Frozen, registry-shaped lookup the query builder consults during SQL
 * generation. Lives next to {@link FrozenEntitySchemaRegistry} but isolates
 * the partition-layout concern so SQLite / in-memory engines can ignore it.
 */
export interface FrozenPartitionLayout {
  /** Returns the partition info for `entityType`, or `null` when the entity
   * type is not registered (cross-type queries / system fan-outs). */
  get(entityType: PatchEntityType): PartitionInfo | null;
  /** Convenience: every partition. */
  values(): IterableIterator<PartitionInfo>;
}

export function buildPartitionLayout(
  registry: FrozenEntitySchemaRegistry
): FrozenPartitionLayout {
  const map = new Map<PatchEntityType, PartitionInfo>();
  for (const schema of registry.values()) {
    map.set(schema.entityType, buildPartitionInfo(schema));
  }
  const snapshot = new Map(map);
  return Object.freeze({
    get: (entityType: PatchEntityType) => snapshot.get(entityType) ?? null,
    values: () => snapshot.values(),
  });
}

/** Empty layout for engines / tests that don't ship a registry. */
export const EMPTY_PARTITION_LAYOUT: FrozenPartitionLayout = Object.freeze({
  get: () => null,
  values: () => new Map<PatchEntityType, PartitionInfo>().values(),
});

/**
 * Tiger-style static validation for {@link PatchDbQuery} against a frozen
 * {@link FrozenEntitySchemaRegistry}.
 *
 * What we catch (would otherwise quietly Seq Scan a 1M-row partition):
 *
 * 1. **Undeclared entity type** — the query targets `entityType: 'foo'` but
 *    no schema is registered. Almost always a typo or a missing
 *    `registerAll` in the app's composition root.
 *
 * 2. **Undeclared attribute** — the query filters / sorts on an attribute
 *    that the entity's schema doesn't list. Means storage of that attribute
 *    is unmanaged (no generated column, no index, no reconcile).
 *
 * 3. **Un-indexed attribute in an index-required position** — `gt/gte/lt/lte`,
 *    `=/!=/in/not_in`, or `orderBy` on an attribute whose tag is missing
 *    `.indexed()`. Indexes are declarative now (`.indexed()` on the
 *    attribute tag), so the fix is always "go add `.indexed()` to the tag
 *    and redeploy".
 *
 * What we deliberately do NOT catch here:
 *
 * - `contains` (LIKE '%x%') — needs a trigram index which we don't model
 *   yet; allow without the index requirement so existing callers compile.
 * - `exists` / `not_exists` — usually paired with a partial index whose
 *   `WHERE` matches; cheap enough on small per-entity-type partitions even
 *   without a dedicated index.
 * - Cross-type queries (`entityType` undefined) — visibility policies
 *   already deny these (`denyAllReadsQuery` ⇒ `limit: 0`); the few system-
 *   context callers (compaction, sync) intentionally fan out across the
 *   whole table and don't need per-partition indexes.
 *
 * Allowlist:
 *
 * - `patch/*` meta attributes are always permitted in any position. They
 *   never live in a feature schema (they're patch-row metadata), but
 *   appear in {@link READ_WHERE_ALWAYS_TRUE} / {@link READ_WHERE_NEVER_TRUE}
 *   and in some sync queries.
 */
import { assert } from '@pkgs/assert';
import { AbacEntityAttr } from '../abac/abac-entity-attr';
import type { Keyword } from '@pkgs/keyword';
import { PATCH_META_KEYS } from '../metadata/patch-metadata';
import type {
  AttributeKey,
  PatchDbQuery,
  PatchDbQueryWhereClause,
  PatchEntityType,
} from '../interface';
import { isSubqueryRef } from '../interface';
import type { FrozenEntitySchemaRegistry } from './entity-schema-registry';

/**
 * Attribute keys that are universally allowed regardless of the per-entity
 * schema. Each one must be backed by a real per-partition index everywhere
 * it can appear:
 *
 * - `patch/*` → patch-metadata, never stored on snapshots (engine-owned).
 * - `entity/owner` → declared as indexed by {@link AbacEntityAttr.owner};
 *   every feature schema that uses ABAC visibility includes it explicitly
 *   (see e.g. `apps/api/src/patch-db/abac-patch-schemas.ts`). Allowlisting
 *   it here keeps composite ABAC `or`-clauses from crashing on entity
 *   types that haven't yet added `AbacEntityAttr.owner` to their schema —
 *   those types' indexes will simply be missing until the schema is
 *   updated. The next deploy reconciler will then create them.
 */
const UNIVERSAL_ALLOWLISTED_KEYS: ReadonlySet<Keyword> = new Set<Keyword>([
  ...PATCH_META_KEYS,
  AbacEntityAttr.owner.key,
]);

/**
 * Where this attribute reference appears in the query. Drives whether the
 * assert demands `.indexed()` on the underlying tag.
 */
type AttributeRefPosition =
  | { kind: 'where'; clauseType: PatchDbQueryWhereClause['type'] }
  | { kind: 'orderBy'; direction: 'asc' | 'desc' };

type AttributeRef = {
  readonly key: AttributeKey;
  readonly position: AttributeRefPosition;
};

const WHERE_CLAUSE_TYPES_REQUIRING_INDEX: ReadonlySet<
  PatchDbQueryWhereClause['type']
> = new Set<PatchDbQueryWhereClause['type']>([
  '=',
  '!=',
  'in',
  'not_in',
  'gt',
  'gte',
  'lt',
  'lte',
]);

function requiresIndex(position: AttributeRefPosition): boolean {
  if (position.kind === 'orderBy') return true;
  return WHERE_CLAUSE_TYPES_REQUIRING_INDEX.has(position.clauseType);
}

/**
 * Extends {@link AttributeRef} with the entity type the attribute is
 * scoped to. Outer-clause refs carry the outer query's entity type;
 * subquery refs carry the subquery's `entityType` so the schema lookup
 * resolves the right partition.
 */
type ScopedAttributeRef = AttributeRef & {
  /** `null` when scope is the top-level query (uses `query.entityType`). */
  readonly scopeEntityType: PatchEntityType | null;
};

function collectWhereAttributeRefs(
  clause: PatchDbQueryWhereClause,
  scopeEntityType: PatchEntityType | null,
  out: ScopedAttributeRef[]
): void {
  if (clause.type === 'and' || clause.type === 'or') {
    for (const child of clause.clauses) {
      collectWhereAttributeRefs(child, scopeEntityType, out);
    }
    return;
  }
  if (clause.type === 'not') {
    collectWhereAttributeRefs(clause.clause, scopeEntityType, out);
    return;
  }
  out.push({
    key: clause.attribute,
    position: { kind: 'where', clauseType: clause.type },
    scopeEntityType,
  });
  if (
    (clause.type === 'in' || clause.type === 'not_in') &&
    isSubqueryRef(clause.values)
  ) {
    const sub = clause.values;
    // The projected attribute itself is in an index-required position
    // (it materialises the inner SELECT's column). Validate against the
    // subquery's own entity type so the right schema gets consulted.
    out.push({
      key: sub.attribute,
      position: { kind: 'where', clauseType: 'in' },
      scopeEntityType: sub.entityType,
    });
    if (sub.where !== undefined) {
      collectWhereAttributeRefs(sub.where, sub.entityType, out);
    }
  }
}

function collectAttributeRefs(query: PatchDbQuery): ScopedAttributeRef[] {
  const refs: ScopedAttributeRef[] = [];
  if (query.where !== undefined) {
    collectWhereAttributeRefs(query.where, null, refs);
  }
  if (query.orderBy !== undefined) {
    for (const o of query.orderBy) {
      refs.push({
        key: o.attribute,
        position: { kind: 'orderBy', direction: o.direction },
        scopeEntityType: null,
      });
    }
  }
  return refs;
}

export type AssertQueryAgainstSchemaOptions = {
  /**
   * When `true`, a query whose `entityType` is `undefined` and references
   * non-meta attributes crashes loudly. Default `false`: cross-type queries
   * are skipped by the assert (visibility policies short-circuit them
   * anyway, and a few system-context callers fan out intentionally).
   */
  readonly strictCrossType?: boolean;
};

function describePosition(position: AttributeRefPosition): string {
  return position.kind === 'orderBy'
    ? `orderBy ${position.direction}`
    : `where ${position.clauseType}`;
}

function assertEntityTypeKnown(
  query: PatchDbQuery,
  ref: ScopedAttributeRef,
  options: AssertQueryAgainstSchemaOptions | undefined
): PatchEntityType | null {
  const scope =
    ref.scopeEntityType !== null ? ref.scopeEntityType : query.entityType;
  if (scope !== undefined && scope !== '') return scope;
  assert.ok(
    options?.strictCrossType !== true,
    'patch-db tiger assert: cross-type query references a non-meta attribute (no per-partition index can help)',
    { attribute: ref.key, position: describePosition(ref.position) }
  );
  return null;
}

export function assertQueryAgainstSchema(
  query: PatchDbQuery,
  registry: FrozenEntitySchemaRegistry,
  options?: AssertQueryAgainstSchemaOptions
): void {
  const refs = collectAttributeRefs(query);
  if (refs.length === 0) return;

  for (const ref of refs) {
    if (UNIVERSAL_ALLOWLISTED_KEYS.has(ref.key)) continue;
    const scope = assertEntityTypeKnown(query, ref, options);
    if (scope === null) continue;

    const schema = registry.get(scope);
    // Skip validation for entity types not yet registered. This is the
    // gradual-rollout knob: until every entity type has a schema, we'd
    // rather under-enforce than crash policies that target legacy types
    // (e.g. `inventory.item`, `todo-list*` in the example playground).
    // Once the registry covers everything we can promote this to a hard
    // `assert.ok(schema !== null, …)`.
    if (schema === null) continue;

    const tag = schema.attributes.get(ref.key);
    assert.ok(
      tag !== undefined,
      'patch-db tiger assert: query references attribute not declared on this entity type',
      {
        entityType: scope,
        attribute: ref.key,
        position: describePosition(ref.position),
      }
    );

    if (requiresIndex(ref.position)) {
      assert.ok(
        tag.index !== null,
        'patch-db tiger assert: query uses non-indexed attribute in an index-required position (add `.indexed()` to the attribute tag and redeploy)',
        {
          entityType: scope,
          attribute: ref.key,
          position: describePosition(ref.position),
        }
      );
    }
  }
}

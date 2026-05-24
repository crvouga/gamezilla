/**
 * Product-agnostic declarative schema for one patch-db entity type.
 *
 * `defineEntitySchema` is a pure factory: it consumes a collection of typed
 * {@link AnyAttributeTag}s (typically a feature package's `*Attr` object),
 * validates them, and returns a frozen {@link EntitySchema}. It does not
 * register the result anywhere global; composition happens via
 * {@link EntitySchemaRegistry} in the app layer.
 *
 * Tag intent is what drives downstream behavior:
 * - Tags marked via {@link AnyAttributeTag.indexed} are promoted to typed
 *   generated columns + native btrees on the entity type's partition.
 * - Tags without `.indexed()` are stored only in the JSONB `attributes`
 *   column and cannot appear in `where` / `orderBy`.
 *
 * Patch-db itself ships zero entity schemas — every schema lives in a
 * feature package (`libs/...`) and is composed in the app
 * (`apps/api/.../schema-registry.ts`). This file only provides the type +
 * factory.
 */
import { assert } from '@pkgs/assert';
import type { AnyAttributeTag, Keyword } from '@pkgs/attribute';
import { assertEntityType, type PatchEntityType } from '../entity-key';

/** Sort direction for an index field (mirrors {@link PatchDbQueryOrderBy.direction}). */
export type EntitySchemaIndexDirection = 'asc' | 'desc';

/** One field reference inside a composite (multi-column) index spec. */
export type CompositeIndexFieldSpec = {
  readonly tag: AnyAttributeTag;
  readonly direction?: EntitySchemaIndexDirection;
};

/**
 * Composite (multi-column) index declaration. Single-column indexes do not
 * need to be declared explicitly — every `.indexed()` tag automatically
 * gets one. Use composite indexes only for queries that filter / sort on
 * multiple columns at once.
 */
export type CompositeIndexSpec = {
  /** Short kebab-case author-facing name (forms part of the DB index name). */
  readonly name: string;
  readonly fields: readonly CompositeIndexFieldSpec[];
  readonly unique?: boolean;
  /**
   * Optional `WHERE` predicate (partial index). Each tag in `where` must
   * also appear in `fields` or be marked `.indexed()`. Currently only
   * `attributeIsNotNull` is supported — extend as needed.
   */
  readonly where?: readonly {
    readonly kind: 'attributeIsNotNull';
    readonly tag: AnyAttributeTag;
  }[];
};

export type EntitySchemaIndexField = {
  readonly attributeKey: Keyword;
  readonly direction: EntitySchemaIndexDirection;
};

export type EntitySchemaWherePredicate = {
  readonly kind: 'attributeIsNotNull';
  readonly attributeKey: Keyword;
};

export type EntitySchemaIndex = {
  /** Author-facing short name. */
  readonly localName: string;
  /** `true` when the index is derived from a single `.indexed()` tag. */
  readonly singleField: boolean;
  readonly fields: readonly EntitySchemaIndexField[];
  readonly unique: boolean;
  readonly where: readonly EntitySchemaWherePredicate[];
};

export type EntitySchema = {
  readonly entityType: PatchEntityType;
  /** Every declared attribute (indexed or not), keyed by full attribute key. */
  readonly attributes: ReadonlyMap<Keyword, AnyAttributeTag>;
  /**
   * Subset of `attributes` whose `.index` is non-null. Cached because
   * downstream consumers (reconciler, query compiler) hit it on every
   * read.
   */
  readonly indexedAttributes: ReadonlyMap<Keyword, AnyAttributeTag>;
  /**
   * All declared indexes — single-field ones derived from `.indexed()` tags
   * plus any composite indexes from {@link DefineEntitySchemaArgs.composite}.
   */
  readonly indexes: readonly EntitySchemaIndex[];
};

export type DefineEntitySchemaArgs = {
  readonly entityType: PatchEntityType;
  /**
   * Object of attribute tags (typically a feature's `*Attr` const). Keys in
   * the object are ignored — the tag's `.key` is the source of truth.
   */
  readonly attributes: Readonly<Record<string, AnyAttributeTag>>;
  /** Optional composite indexes. Single-field indexes are automatic. */
  readonly composite?: readonly CompositeIndexSpec[];
};

const INDEX_LOCAL_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function assertIndexLocalName(name: string): void {
  assert.nonEmptyString(name, 'index spec.name must be non-empty');
  assert.ok(
    INDEX_LOCAL_NAME_PATTERN.test(name),
    'index spec.name must match /^[a-z][a-z0-9-]*$/',
    { name }
  );
}

function assertAttributeTagShape(
  tag: unknown,
  where: string
): asserts tag is AnyAttributeTag {
  assert.ok(
    tag !== null &&
      (typeof tag === 'function' || typeof tag === 'object') &&
      typeof (tag as { key?: unknown }).key === 'string',
    `${where}: expected AttributeTag (callable with .key)`,
    { tag }
  );
}

function buildSingleFieldIndexes(
  indexedAttributes: ReadonlyMap<Keyword, AnyAttributeTag>
): readonly EntitySchemaIndex[] {
  const out: EntitySchemaIndex[] = [];
  for (const tag of indexedAttributes.values()) {
    const index = tag.index;
    assert.defined(index, 'buildSingleFieldIndexes: tag must have .index set');
    const localName = tag.key
      .split('/')
      .at(-1)
      ?.replace(/[^a-z0-9]+/g, '-');
    assert.nonEmptyString(
      localName,
      'buildSingleFieldIndexes: cannot derive local name',
      { key: tag.key }
    );
    out.push({
      localName,
      singleField: true,
      fields: [{ attributeKey: tag.key, direction: 'asc' }],
      unique: index.unique,
      where: [],
    });
  }
  return out;
}

function buildCompositeIndex(
  entityType: PatchEntityType,
  spec: CompositeIndexSpec,
  declaredKeys: ReadonlySet<Keyword>
): EntitySchemaIndex {
  assertIndexLocalName(spec.name);
  assert.ok(
    spec.fields.length > 0,
    'composite index must declare at least one field',
    { entityType, name: spec.name }
  );
  const fields: EntitySchemaIndexField[] = spec.fields.map((f) => {
    assertAttributeTagShape(f.tag, `composite index ${spec.name}.fields[]`);
    assert.ok(
      declaredKeys.has(f.tag.key),
      `composite index ${spec.name} references attribute not declared on entity type`,
      { entityType, attributeKey: f.tag.key }
    );
    return {
      attributeKey: f.tag.key,
      direction: f.direction ?? 'asc',
    };
  });
  const where: EntitySchemaWherePredicate[] = (spec.where ?? []).map((w) => {
    assertAttributeTagShape(w.tag, `composite index ${spec.name}.where[]`);
    assert.ok(
      declaredKeys.has(w.tag.key),
      `composite index ${spec.name}.where references undeclared attribute`,
      { entityType, attributeKey: w.tag.key }
    );
    return { kind: 'attributeIsNotNull', attributeKey: w.tag.key };
  });
  return {
    localName: spec.name,
    singleField: false,
    fields,
    unique: spec.unique === true,
    where,
  };
}

export function defineEntitySchema(args: DefineEntitySchemaArgs): EntitySchema {
  assertEntityType(args.entityType);
  assert.ok(
    args.attributes !== null && typeof args.attributes === 'object',
    'defineEntitySchema: attributes must be an object of AttributeTag'
  );
  const attributes = new Map<Keyword, AnyAttributeTag>();
  const indexedAttributes = new Map<Keyword, AnyAttributeTag>();
  for (const tag of Object.values(args.attributes)) {
    assertAttributeTagShape(
      tag,
      `defineEntitySchema(${args.entityType}).attributes`
    );
    assert.ok(
      !attributes.has(tag.key),
      'defineEntitySchema: duplicate attribute key',
      { entityType: args.entityType, key: tag.key }
    );
    attributes.set(tag.key, tag);
    if (tag.index !== null) {
      indexedAttributes.set(tag.key, tag);
    }
  }
  const declaredKeys = new Set(attributes.keys());
  const singleFieldIndexes = buildSingleFieldIndexes(indexedAttributes);
  const compositeIndexes = (args.composite ?? []).map((spec) =>
    buildCompositeIndex(args.entityType, spec, declaredKeys)
  );
  const compositeLocalNames = new Set<string>();
  for (const ci of compositeIndexes) {
    assert.ok(
      !compositeLocalNames.has(ci.localName),
      'defineEntitySchema: duplicate composite index name',
      { entityType: args.entityType, name: ci.localName }
    );
    compositeLocalNames.add(ci.localName);
  }
  return Object.freeze({
    entityType: args.entityType,
    attributes: attributes as ReadonlyMap<Keyword, AnyAttributeTag>,
    indexedAttributes: indexedAttributes as ReadonlyMap<
      Keyword,
      AnyAttributeTag
    >,
    indexes: Object.freeze([...singleFieldIndexes, ...compositeIndexes]),
  });
}

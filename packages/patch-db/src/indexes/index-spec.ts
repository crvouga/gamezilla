/**
 * Declarative, db-agnostic spec for snapshot expression / partial indexes.
 *
 * App code constructs `PatchDbIndexSpec` values from typed `AttributeTag`s and
 * `*_ENTITY_TYPE` constants — never raw SQL — and patch-db's engine compilers
 * (Postgres, SQLite) translate the same spec into native DDL.
 *
 * The {@link normalizeIndexSpec} step extracts `.key` from `AttributeTag`-like
 * inputs, validates every keyword / entity-type at the same boundary patch-db
 * already enforces (`assertAttribute`, `assertEntityType`), and computes a
 * deterministic DB-side index name that embeds a content hash so any change to
 * a spec's fields / where clauses produces a new identifier (the old one
 * becomes an orphan and is dropped on the next reconcile).
 */
import type { Assert } from '@gamezilla/lib/assert';
import { assert } from '@gamezilla/lib/assert';
import {
  assertAttribute,
  assertEntityType,
  type PatchEntityType,
} from '../entity-key';
import type { Keyword } from '@gamezilla/lib/keyword';

/** Attribute reference for index specs. Accepts a {@link Keyword} or any
 * object with a `.key` property (e.g. an `AttributeTag` from `@gamezilla/lib/attribute`). */
export type PatchDbIndexAttributeRef = Keyword | { readonly key: Keyword };

export type PatchDbIndexField =
  | { readonly kind: 'attribute'; readonly attribute: PatchDbIndexAttributeRef }
  | { readonly kind: 'entityId' }
  | { readonly kind: 'entityType' };

export type PatchDbIndexWhere =
  | {
      readonly kind: 'attributeExists';
      readonly attribute: PatchDbIndexAttributeRef;
    }
  | {
      readonly kind: 'attributeAbsent';
      readonly attribute: PatchDbIndexAttributeRef;
    };

/**
 * Single declarative snapshot index. Every spec implicitly filters on
 * `entity_type = entityType`; engine compilers always emit that predicate so a
 * spec for entity type `space` only covers rows of that type.
 */
export type PatchDbIndexSpec = {
  /** Short, kebab-case author-facing name. Combined with `entityType` to
   * derive the final DB-side identifier. */
  readonly name: string;
  readonly entityType: PatchEntityType;
  /** At least one field. `entityId` / `entityType` map to the table fields;
   * `attribute` maps to the engine's JSON-extract field. */
  readonly fields: readonly PatchDbIndexField[];
  /** Extra predicates ANDed into the partial-index `WHERE` clause. */
  readonly where?: readonly PatchDbIndexWhere[];
};

export type NormalizedIndexField =
  | { readonly kind: 'attribute'; readonly attribute: Keyword }
  | { readonly kind: 'entityId' }
  | { readonly kind: 'entityType' };

export type NormalizedIndexWhere =
  | { readonly kind: 'attributeExists'; readonly attribute: Keyword }
  | { readonly kind: 'attributeAbsent'; readonly attribute: Keyword };

export type NormalizedIndexSpec = {
  /** Original author-facing short name (kebab-case). */
  readonly localName: string;
  /** DB-side identifier: `pdb_idx_<entityTypeSlug>__<localName>__<hash8>`.
   * Stable for a given normalized content; any change rolls the hash so the
   * old index becomes an orphan and is dropped on the next reconcile. */
  readonly dbName: string;
  readonly entityType: PatchEntityType;
  readonly fields: readonly NormalizedIndexField[];
  readonly where: readonly NormalizedIndexWhere[];
};

/** Prefix the reconciler uses to identify indexes it owns; the library never
 * touches indexes outside this prefix. */
export const PATCH_DB_INDEX_NAME_PREFIX = 'pdb_idx_';

/** Postgres identifier limit (NAMEDATALEN - 1). SQLite has no comparable hard
 * cap but we apply the same limit so specs are portable. */
const MAX_DB_NAME_LEN = 63;

const INDEX_LOCAL_NAME_PATTERN = /^[a-z][a-z0-9-]*$/;

function attributeKeyOf(ref: PatchDbIndexAttributeRef, a: Assert): Keyword {
  if (typeof ref === 'string') {
    assertAttribute(ref, a);
    return ref;
  }
  // `AttributeTag` is a callable function with a non-enumerable `.key`; accept
  // either a plain object or a function so spec authors can pass tags directly.
  a.ok(
    ref !== null &&
      (typeof ref === 'object' || typeof ref === 'function') &&
      !Array.isArray(ref),
    'index attribute ref must be string, AttributeTag, or { key }',
    { value: ref }
  );
  const obj = ref as { key?: unknown };
  a.string(obj.key, 'index attribute ref.key must be string');
  assertAttribute(obj.key, a);
  return obj.key;
}

function entityTypeToSlug(entityType: string): string {
  // `space.membership` -> `space_membership`; kebab segments stay kebab but
  // lowercased underscores are friendlier in identifiers.
  return entityType.replace(/[.-]/g, '_');
}

function localNameToSlug(name: string): string {
  return name.replace(/-/g, '_');
}

/** djb2 — non-cryptographic, deterministic, 32-bit. Used purely as a content
 * fingerprint so spec edits roll the DB-side index name. */
function djb2Hex(input: string): string {
  let h = 5381;
  for (let i = 0; i < input.length; i++) {
    h = ((h << 5) + h + input.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

function fingerprintContent(
  entityType: string,
  fields: readonly NormalizedIndexField[],
  where: readonly NormalizedIndexWhere[]
): string {
  const colPart = fields
    .map((c) => (c.kind === 'attribute' ? `attr:${c.attribute}` : c.kind))
    .join('|');
  const wherePart = where.map((w) => `${w.kind}:${w.attribute}`).join('|');
  return djb2Hex(`${entityType}\n${colPart}\n${wherePart}`);
}

export function normalizeIndexSpec(
  spec: PatchDbIndexSpec,
  a: Assert = assert
): NormalizedIndexSpec {
  a.record(spec, 'index spec must be an object');
  a.string(spec.name, 'index spec.name must be string');
  a.ok(
    INDEX_LOCAL_NAME_PATTERN.test(spec.name),
    'index spec.name must match /^[a-z][a-z0-9-]*$/',
    { name: spec.name }
  );
  assertEntityType(spec.entityType, a);
  a.array(spec.fields, 'index spec.fields must be array');
  a.ok(
    spec.fields.length > 0,
    'index spec.fields must declare at least one field',
    { name: spec.name }
  );

  const fields: NormalizedIndexField[] = spec.fields.map((c) => {
    a.record(c, 'index spec.fields[] must be object');
    if (c.kind === 'attribute') {
      return { kind: 'attribute', attribute: attributeKeyOf(c.attribute, a) };
    }
    a.ok(
      c.kind === 'entityId' || c.kind === 'entityType',
      'index spec.fields[].kind must be attribute|entityId|entityType',
      { kind: c.kind }
    );
    return { kind: c.kind };
  });

  const where: NormalizedIndexWhere[] = (spec.where ?? []).map((w) => {
    a.record(w, 'index spec.where[] must be object');
    a.ok(
      w.kind === 'attributeExists' || w.kind === 'attributeAbsent',
      'index spec.where[].kind must be attributeExists|attributeAbsent',
      { kind: w.kind }
    );
    return { kind: w.kind, attribute: attributeKeyOf(w.attribute, a) };
  });

  const hash = fingerprintContent(spec.entityType, fields, where);
  const dbName = `${PATCH_DB_INDEX_NAME_PREFIX}${entityTypeToSlug(
    spec.entityType
  )}__${localNameToSlug(spec.name)}__${hash}`;
  a.ok(
    dbName.length <= MAX_DB_NAME_LEN,
    `index spec produces too-long DB identifier (${dbName.length} > ${MAX_DB_NAME_LEN}); shorten spec.name or entityType`,
    { dbName }
  );

  return {
    localName: spec.name,
    dbName,
    entityType: spec.entityType,
    fields: fields,
    where,
  };
}

/** Normalize a list of specs and assert that DB-side names are unique. */
export function normalizeIndexSpecs(
  specs: readonly PatchDbIndexSpec[],
  a: Assert = assert
): readonly NormalizedIndexSpec[] {
  const out: NormalizedIndexSpec[] = specs.map((s) => normalizeIndexSpec(s, a));
  const localSeen = new Set<string>();
  const dbSeen = new Set<string>();
  for (const s of out) {
    a.ok(
      !localSeen.has(`${s.entityType}\0${s.localName}`),
      `duplicate index local name within entity type: ${s.entityType}/${s.localName}`
    );
    localSeen.add(`${s.entityType}\0${s.localName}`);
    a.ok(!dbSeen.has(s.dbName), `duplicate index db name: ${s.dbName}`);
    dbSeen.add(s.dbName);
  }
  return out;
}

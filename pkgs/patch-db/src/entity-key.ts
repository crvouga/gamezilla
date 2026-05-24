/**
 * Foundational entity-key / attribute-key validators shared across patch-db's
 * `interface` (high-level Patch/Entity types) and the schema layer. Lives in
 * its own module so both can depend on it without forming an import cycle.
 */
import type { Assert } from '@pkgs/assert';
import { assert } from '@pkgs/assert';
import type { AttributeState } from '@pkgs/attribute';
import {
  assertKeywordRecord,
  isNamespacedKeyword,
  isNamespacePrefix,
  type Keyword,
} from '@pkgs/keyword';

/**
 * Namespaced attribute key used in queries and the `attributes` map.
 * Same brand as {@link Keyword}; obtain via {@link assertAttribute}, {@link asKeyword},
 * or {@link @pkgs/attribute.createAttrNamespace} tags (`.key`).
 */
export type AttributeKey = Keyword;

/**
 * Dot-separated kebab namespace for entity types
 * (same grammar as an attribute key's namespace prefix; no `/`).
 *
 * Validated at runtime by {@link assertEntityType}; all wire / persistence
 * boundaries pipe untrusted inputs through it before the rest of the pipeline.
 */
export type PatchEntityType = string;

const ID_MAX_LEN = 1024;

/** Asserts and tags `t` as a {@link PatchEntityType}. Crashes on invalid input. */
export function asEntityType(t: string, a: Assert = assert): PatchEntityType {
  assertEntityType(t, a);
  return t;
}

/** Asserts patchId is sufficient for global uniqueness: non-empty, no null bytes, no trim loss, min length. */
export function assertPatchId(
  id: unknown,
  a: Assert = assert
): asserts id is string {
  a.string(id, 'patchId must be string');
  a.ok(id.length > 0, 'patchId must be non-empty');
  a.ok(id.length <= ID_MAX_LEN, 'patchId must not exceed 1024 chars');
  a.ok(!id.includes('\0'), 'patchId must not contain null byte');
  a.ok(id === id.trim(), 'patchId must not have leading/trailing whitespace');
  a.ok(
    id.length >= 8,
    'patchId must be at least 8 chars for global uniqueness',
    { id }
  );
}

/** Asserts entityId is sufficient for global uniqueness (with entityType): non-empty, no null bytes, no trim loss. */
export function assertEntityId(
  id: unknown,
  a: Assert = assert
): asserts id is string {
  a.string(id, 'entityId must be string');
  a.ok(id.length > 0, 'entityId must be non-empty');
  a.ok(id.length <= ID_MAX_LEN, 'entityId must not exceed 1024 chars');
  a.ok(!id.includes('\0'), 'entityId must not contain null byte');
  a.ok(id === id.trim(), 'entityId must not have leading/trailing whitespace');
}

/** Asserts entityType is sufficient for global uniqueness (with entityId): non-empty, no null bytes, no trim loss, dot-kebab namespace. */
export function assertEntityType(
  t: unknown,
  a: Assert = assert
): asserts t is PatchEntityType {
  a.string(t, 'entityType must be string');
  a.ok(t.length > 0, 'entityType must be non-empty');
  a.ok(t.length <= ID_MAX_LEN, 'entityType must not exceed 1024 chars');
  a.ok(!t.includes('\0'), 'entityType must not contain null byte');
  a.ok(t === t.trim(), 'entityType must not have leading/trailing whitespace');
  a.ok(
    isNamespacePrefix(t),
    'entityType must be a dot-separated kebab namespace (e.g. todo, todo-list, chess.puzzle)',
    { entityType: t }
  );
}

/** Asserts entity key (entityId + entityType) is sufficient for global uniqueness. */
export function assertEntityKey(
  entityId: unknown,
  entityType: unknown,
  a?: Assert
): asserts entityId is string {
  assertEntityId(entityId, a);
  assertEntityType(entityType, a);
}

/** Returns true if the key is a valid namespaced attribute. Use when reading stored data that may be stale. */
export function isValidAttribute(key: unknown): key is Keyword {
  return isNamespacedKeyword(key);
}

/**
 * Sanitizes an attribute name to ensure it follows Clojure-style namespaced key conventions.
 * Valid: Clojure-style kebab-case namespaced keys (e.g. "todo/title", "patch/synced-at").
 * @param attribute - The attribute to sanitize.
 * @returns The sanitized attribute.
 */
export function assertAttribute(
  attribute: unknown,
  a: Assert = assert
): asserts attribute is Keyword {
  a.string(attribute, 'Invalid attribute name — must be a string');
  a.ok(
    isNamespacedKeyword(attribute),
    'Invalid attribute name — must be a Clojure-style namespaced key'
  );
}

/**
 * Validates and returns the PatchDB namespaced key for SQL builders.
 */
export function patchDbAttributeKey(
  attribute: string | null | undefined
): Keyword {
  assert.ok(
    attribute !== null && attribute !== undefined && attribute !== '',
    'query clause attribute is required'
  );
  assertAttribute(attribute);
  return attribute;
}

export function assertAttributes(
  attributes: unknown,
  a: Assert = assert
): asserts attributes is Record<Keyword, unknown> {
  a.record(attributes, 'attributes must be object');
  assertKeywordRecord(a, attributes as Record<string, unknown>, 'attributes');
}

/**
 * Validates every key is a namespaced keyword, then returns the same object as
 * {@link AttributeState} for {@link PatchInput.attributes} / {@link Entity.attributes}.
 */
export function toAttributeState(
  record: Record<string, unknown>,
  label = 'attributes'
): AttributeState {
  assertKeywordRecord(assert, record, label);
  return record as AttributeState;
}

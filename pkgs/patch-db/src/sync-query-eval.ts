/* eslint-disable complexity */
import type { AttributeState } from '@pkgs/attribute';
import { assert } from '@pkgs/assert';
import type {
  AttributeKey,
  Entity,
  PatchDbQuery,
  PatchDbQueryWhereClause,
  PatchDbResult,
} from './interface';
import { assertDirection, patchDbAttributeKey } from './interface';
import type { InMemoryEntityStore } from './in-memory-store';

function readAttr(attrs: AttributeState, attribute: AttributeKey): unknown {
  const key = patchDbAttributeKey(attribute);
  return attrs[key];
}

export function evaluateWhere(
  clause: PatchDbQueryWhereClause,
  attrs: AttributeState
): boolean {
  if (clause.type === 'and') {
    return clause.clauses.length === 0
      ? true
      : clause.clauses.every((c) => evaluateWhere(c, attrs));
  }
  if (clause.type === 'or') {
    return clause.clauses.length === 0
      ? false
      : clause.clauses.some((c) => evaluateWhere(c, attrs));
  }
  if (clause.type === 'not') {
    return !evaluateWhere(clause.clause, attrs);
  }

  const attrValue =
    'attribute' in clause ? readAttr(attrs, clause.attribute) : undefined;

  switch (clause.type) {
    case '=':
      return attrValue === clause.value;
    case '!=':
      return attrValue !== clause.value;
    case 'gt':
      return typeof attrValue === 'number' && typeof clause.value === 'number'
        ? attrValue > clause.value
        : false;
    case 'gte':
      return typeof attrValue === 'number' && typeof clause.value === 'number'
        ? attrValue >= clause.value
        : false;
    case 'lt':
      return typeof attrValue === 'number' && typeof clause.value === 'number'
        ? attrValue < clause.value
        : false;
    case 'lte':
      return typeof attrValue === 'number' && typeof clause.value === 'number'
        ? attrValue <= clause.value
        : false;
    case 'contains':
      return typeof attrValue === 'string'
        ? attrValue.includes(clause.value)
        : false;
    case 'exists':
      return attrValue !== null && attrValue !== undefined;
    case 'not_exists':
      return attrValue === null || attrValue === undefined;
    case 'in':
      return clause.values.length === 0
        ? false
        : clause.values.some((x) => Object.is(x, attrValue));
    case 'not_in':
      return clause.values.length === 0
        ? true
        : !clause.values.some((x) => Object.is(x, attrValue));
    default: {
      const _exhaustive: never = clause;
      throw new Error(`Unhandled where clause: ${String(_exhaustive)}`);
    }
  }
}

type SortKey = string | number | boolean | null | undefined;

function sortKeyForAttribute(
  attrs: AttributeState,
  attribute: AttributeKey
): SortKey {
  const v = readAttr(attrs, attribute);
  if (
    typeof v === 'string' ||
    typeof v === 'number' ||
    typeof v === 'boolean' ||
    v === null ||
    v === undefined
  ) {
    return v;
  }
  // Non-primitive attributes are not orderable; treat as undefined.
  return undefined;
}

function compareKey(a: SortKey, b: SortKey): number {
  if (a === b) return 0;
  if (a === undefined) return 1;
  if (b === undefined) return -1;
  if (a === null) return 1;
  if (b === null) return -1;
  if (typeof a === typeof b) {
    return a < b ? -1 : 1;
  }
  // Mixed types: deterministic string compare on type name.
  const ta = typeof a;
  const tb = typeof b;
  return ta < tb ? -1 : 1;
}

export function evaluateQuery(
  query: PatchDbQuery,
  store: InMemoryEntityStore
): PatchDbResult {
  assert.ok(
    query.on === undefined || query.on === null || query.on === 'entities',
    'sync query evaluator does not support on:patches',
    { query }
  );
  assert.ok(
    query.after === undefined || query.after === null,
    'sync query evaluator does not support cursor queries (after)',
    { query }
  );

  const candidates = collectCandidates(query, store);
  const filtered = applyWhere(query, candidates);
  applyOrder(query, filtered);

  const total = filtered.length;
  const { slice, hasMore } = applyPage(query, filtered, total);

  return {
    query,
    entities: slice,
    patches: [],
    total,
    hasMore,
    nextCursor: null,
  };
}

function collectCandidates(
  query: PatchDbQuery,
  store: InMemoryEntityStore
): Entity[] {
  const out: Entity[] = [];
  if (typeof query.entityType === 'string' && query.entityType.length > 0) {
    if (typeof query.entityId === 'string') {
      const e = store.getEntity(query.entityType, query.entityId);
      if (e) out.push(e);
      return out;
    }
    if (Array.isArray(query.entityId)) {
      for (const id of query.entityId) {
        const e = store.getEntity(query.entityType, id);
        if (e) out.push(e);
      }
      return out;
    }
    for (const e of store.iterByType(query.entityType)) out.push(e);
    return out;
  }

  if (typeof query.entityId === 'string') {
    for (const e of store.iterAll())
      if (e.entityId === query.entityId) out.push(e);
    return out;
  }
  if (Array.isArray(query.entityId)) {
    const set = new Set(query.entityId);
    for (const e of store.iterAll()) if (set.has(e.entityId)) out.push(e);
    return out;
  }
  for (const e of store.iterAll()) out.push(e);
  return out;
}

function applyWhere(query: PatchDbQuery, candidates: Entity[]): Entity[] {
  if (query.where === undefined || query.where === null) return candidates;
  return candidates.filter((e) => evaluateWhere(query.where!, e.attributes));
}

function applyOrder(query: PatchDbQuery, entities: Entity[]): void {
  if (query.orderBy && query.orderBy.length > 0) {
    const order = query.orderBy;
    for (const o of order) assertDirection(o.direction);
    entities.sort((ea, eb) => {
      for (const o of order) {
        const ka = sortKeyForAttribute(ea.attributes, o.attribute);
        const kb = sortKeyForAttribute(eb.attributes, o.attribute);
        const cmp = compareKey(ka, kb);
        if (cmp !== 0) return o.direction === 'desc' ? -cmp : cmp;
      }
      if (ea.entityId !== eb.entityId)
        return ea.entityId < eb.entityId ? -1 : 1;
      if (ea.entityType !== eb.entityType)
        return ea.entityType < eb.entityType ? -1 : 1;
      return 0;
    });
    return;
  }
  entities.sort((a, b) =>
    a.entityId < b.entityId ? -1 : a.entityId > b.entityId ? 1 : 0
  );
}

function applyPage(
  query: PatchDbQuery,
  entities: Entity[],
  total: number
): { slice: Entity[]; hasMore: boolean } {
  const offset = query.offset ?? 0;
  const limit = query.limit;
  const slice =
    limit === undefined || limit === null
      ? entities.slice(offset)
      : entities.slice(offset, offset + limit);
  const hasMore =
    limit !== undefined && limit !== null
      ? offset + slice.length < total
      : false;
  return { slice, hasMore };
}

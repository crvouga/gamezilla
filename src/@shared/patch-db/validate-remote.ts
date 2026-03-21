import { assert, assertArray } from '../assert';
import type { Entity, Patch, PatchesDbResult } from './interface';

function assertObject(
  value: unknown,
  message: string
): asserts value is Record<string, unknown> {
  assert(
    value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      value !== undefined,
    message,
    { value }
  );
}

function assertPatchesDbResult(
  value: unknown
): asserts value is PatchesDbResult {
  assertObject(value, 'PatchesDbResult must be an object');
  assert('query' in value, 'PatchesDbResult must have query', { value });
  assertArray(value['entities'], 'PatchesDbResult.entities must be an array');
  assertArray(value['patches'], 'PatchesDbResult.patches must be an array');
  assert(
    typeof value['total'] === 'number',
    'PatchesDbResult.total must be number'
  );
  assert(
    typeof value['hasMore'] === 'boolean',
    'PatchesDbResult.hasMore must be boolean'
  );
  assert(
    value['nextCursor'] === null || typeof value['nextCursor'] === 'string',
    'PatchesDbResult.nextCursor must be string or null'
  );
}

function assertEntity(value: unknown): asserts value is Entity {
  assertObject(value, 'Entity must be an object');
  assert(
    typeof value['entityId'] === 'string',
    'Entity.entityId must be string'
  );
  assert(
    typeof value['entityType'] === 'string',
    'Entity.entityType must be string'
  );
  assertObject(value['attributes'], 'Entity.attributes must be object');
}

function assertPatch(value: unknown): asserts value is Patch {
  assertObject(value, 'Patch must be an object');
  const v = value as Record<string, unknown>;
  assert(typeof v['patchId'] === 'string', 'Patch.patchId must be string');
  assert(typeof v['entityId'] === 'string', 'Patch.entityId must be string');
  assert(
    typeof v['entityType'] === 'string',
    'Patch.entityType must be string'
  );
  assertObject(v['attributes'], 'Patch.attributes must be object');
  assert(
    v['parentId'] === null || typeof v['parentId'] === 'string',
    'Patch.parentId must be string or null'
  );
  assert(typeof v['createdAt'] === 'string', 'Patch.createdAt must be string');
  assert(
    typeof v['recordedAt'] === 'string',
    'Patch.recordedAt must be string'
  );
  assert(typeof v['createdBy'] === 'string', 'Patch.createdBy must be string');
  assert(typeof v['sessionId'] === 'string', 'Patch.sessionId must be string');
}

/**
 * Validates remote response for read(). Call after res.json() at trust boundary.
 */
export function validatePatchesDbResults(
  value: unknown
): asserts value is PatchesDbResult[] {
  assertArray(value, 'Response must be an array of PatchesDbResult');
  const arr = value as PatchesDbResult[];
  for (const result of arr) {
    assertPatchesDbResult(result);
    for (const entity of result.entities) {
      assertEntity(entity);
    }
    for (const patch of result.patches) {
      assertPatch(patch);
    }
  }
}

/**
 * Validates remote response for write(). Call after res.json() at trust boundary.
 */
export function validatePatches(value: unknown): asserts value is Patch[] {
  assertArray(value, 'Response must be an array of Patch');
  const arr = value as Patch[];
  for (const patch of arr) {
    assertPatch(patch);
  }
}

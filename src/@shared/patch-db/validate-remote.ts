import { assert } from '../assert';
import {
  assertEntityKey,
  assertPatchId,
  type Entity,
  type Patch,
  type PatchesDbResult,
} from './interface';

function assertObject(
  value: unknown,
  message: string
): asserts value is Record<string, unknown> {
  assert.ok(
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
  assert.ok('query' in value, 'PatchesDbResult must have query', { value });
  assert.array(value['entities'], 'PatchesDbResult.entities must be an array');
  assert.array(value['patches'], 'PatchesDbResult.patches must be an array');
  assert.ok(
    typeof value['total'] === 'number',
    'PatchesDbResult.total must be number'
  );
  assert.ok(
    typeof value['hasMore'] === 'boolean',
    'PatchesDbResult.hasMore must be boolean'
  );
  assert.ok(
    value['nextCursor'] === null || typeof value['nextCursor'] === 'string',
    'PatchesDbResult.nextCursor must be string or null'
  );
}

function assertEntity(value: unknown): asserts value is Entity {
  assertObject(value, 'Entity must be an object');
  assert.ok(
    typeof value['entityId'] === 'string',
    'Entity.entityId must be string'
  );
  assert.ok(
    typeof value['entityType'] === 'string',
    'Entity.entityType must be string'
  );
  assertEntityKey(value['entityId'], value['entityType']);
  assertObject(value['attributes'], 'Entity.attributes must be object');
}

function assertPatch(value: unknown): asserts value is Patch {
  assertObject(value, 'Patch must be an object');
  const v = value as Record<string, unknown>;
  assert.ok(typeof v['patchId'] === 'string', 'Patch.patchId must be string');
  assert.ok(typeof v['entityId'] === 'string', 'Patch.entityId must be string');
  assert.ok(
    typeof v['entityType'] === 'string',
    'Patch.entityType must be string'
  );
  assertPatchId(v['patchId']);
  assertEntityKey(v['entityId'], v['entityType']);
  assertObject(v['attributes'], 'Patch.attributes must be object');
  assert.ok(
    v['parentId'] === null || typeof v['parentId'] === 'string',
    'Patch.parentId must be string or null'
  );
  assert.ok(
    typeof v['createdAt'] === 'string',
    'Patch.createdAt must be string'
  );
  assert.ok(
    typeof v['recordedAt'] === 'string',
    'Patch.recordedAt must be string'
  );
  assert.ok(
    typeof v['createdBy'] === 'string',
    'Patch.createdBy must be string'
  );
  assert.ok(
    typeof v['sessionId'] === 'string',
    'Patch.sessionId must be string'
  );
}

/**
 * Validates remote response for read(). Call after res.json() at trust boundary.
 */
export function assertPatchesDbResults(
  value: unknown
): asserts value is PatchesDbResult[] {
  assert.array(value, 'PatchesDbResults must be an array');
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
export function assertPatches(value: unknown): asserts value is Patch[] {
  assert.array(value, 'Patches must be an array');
  const arr = value as Patch[];
  for (const patch of arr) {
    assertPatch(patch);
  }
}

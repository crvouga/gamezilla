import { assert } from '@pkgs/assert';
import {
  assertAttribute,
  assertAttributes,
  assertEntityKey,
  assertPatchId,
  assertPatchInput,
  type Entity,
  type Patch,
  type PatchDbResult,
  type WritePatchesResult,
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

function assertPatchDbResult(value: unknown): asserts value is PatchDbResult {
  assertObject(value, 'PatchDbResult must be an object');
  assert.ok('query' in value, 'PatchDbResult must have query', { value });
  assert.array(value['entities'], 'PatchDbResult.entities must be an array');
  assert.array(value['patches'], 'PatchDbResult.patches must be an array');
  assert.ok(
    typeof value['total'] === 'number',
    'PatchDbResult.total must be number'
  );
  assert.ok(
    typeof value['hasMore'] === 'boolean',
    'PatchDbResult.hasMore must be boolean'
  );
  assert.ok(
    value['nextCursor'] === null || typeof value['nextCursor'] === 'string',
    'PatchDbResult.nextCursor must be string or null'
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
  assertAttributes(value['attributes']);
}

function assertPatch(value: unknown): asserts value is Patch {
  assertObject(value, 'Patch must be an object');
  const v = value;
  assert.ok(typeof v['patchId'] === 'string', 'Patch.patchId must be string');
  assert.ok(typeof v['entityId'] === 'string', 'Patch.entityId must be string');
  assert.ok(
    typeof v['entityType'] === 'string',
    'Patch.entityType must be string'
  );
  assertPatchId(v['patchId']);
  assertEntityKey(v['entityId'], v['entityType']);
  assertObject(v['attributes'], 'Patch.attributes must be object');
  assertAttributes(v['attributes']);
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
export function assertPatchDbResults(
  value: unknown
): asserts value is PatchDbResult[] {
  assert.array(value, 'PatchDbResults must be an array');
  const arr = value;
  for (const result of arr) {
    assertPatchDbResult(result);
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
  const arr = value;
  for (const patch of arr) {
    assertPatch(patch);
  }
}

function assertPatchRejectionReason(value: unknown): void {
  assertObject(value, 'PatchRejectionReason must be an object');
  const v = value;
  assert.ok(
    typeof v['patchId'] === 'string',
    'rejection.patchId must be string'
  );
  assertPatchId(v['patchId']);
  assert.ok(typeof v['code'] === 'string', 'rejection.code must be string');
  assertAttribute(v['code']);
  assert.ok(typeof v['reason'] === 'string', 'rejection.reason must be string');
  if ('patch' in v && v['patch'] !== undefined && v['patch'] !== null) {
    assertPatchInput(assert, v['patch']);
  }
}

/**
 * Validates remote response for write() after partial-reject wire shape.
 */
export function assertWriteResponse(
  value: unknown
): asserts value is WritePatchesResult {
  assertObject(value, 'WritePatchesResult must be an object');
  assert.ok(Array.isArray(value['accepted']), 'accepted must be an array');
  assert.ok(Array.isArray(value['rejected']), 'rejected must be an array');
  for (const p of value['accepted'] as unknown[]) {
    assertPatch(p);
  }
  for (const r of value['rejected'] as unknown[]) {
    assertPatchRejectionReason(r);
  }
}

export type PatchDbWireReadResponse = {
  results: PatchDbResult[];
};

export type PatchDbWireWriteResponse = WritePatchesResult;

/**
 * Validates remote `/patches/read` JSON (trust boundary): `{ results }`.
 */
export function assertWireReadResponse(
  value: unknown
): asserts value is PatchDbWireReadResponse {
  assertObject(value, 'wire read response must be an object');
  assert.ok(Array.isArray(value['results']), 'results must be an array');
  assertPatchDbResults(value['results']);
}

/**
 * Validates remote `/patches/write` JSON (trust boundary): flat accepted/rejected.
 */
export function assertWireWriteResponse(
  value: unknown
): asserts value is PatchDbWireWriteResponse {
  assertWriteResponse(value);
}

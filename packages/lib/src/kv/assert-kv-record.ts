import { assert } from '../assert';
import { assertKeywordRecord } from '../keyword/keyword';
import type { KvRecord } from './interface';

/**
 * Runtime guard: every own-enumerable key must be a wire-valid {@link Keyword}.
 * Same contract as patch-db attributes / room state.
 */
export function assertKvRecord(
  value: unknown,
  label: string
): asserts value is KvRecord {
  assertKeywordRecord(value as Record<string, unknown>, label);
}

/**
 * Normalizes a DB/driver payload (parsed jsonb object or legacy JSON text) into
 * a validated {@link KvRecord}.
 */
export function parseKvRecordFromUnknown(
  raw: unknown,
  label: string
): KvRecord {
  let v: unknown = raw;
  if (typeof v === 'string') {
    const s = v;
    try {
      v = JSON.parse(s) as unknown;
    } catch {
      assert.fail(`${label}: JSON parse failed`, {
        raw: s.slice(0, 200),
      });
    }
  }
  assertKvRecord(v, label);
  return v;
}

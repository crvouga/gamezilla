import type { Assert } from '@pkgs/assert-shared/assert';
import { assertKeywordRecord } from '@pkgs/keyword-shared/keyword';
import type { KvRecord } from './interface';

/**
 * Runtime guard: every own-enumerable key must be a wire-valid {@link Keyword}.
 * Same contract as sync entity attributes / room state.
 *
 * `a` controls cost: pass `assert` (always-on) for trust-boundary parsing of
 * persisted blobs; pass `hotAssert()` for per-`get`/`put` checks on hot paths.
 */
export function assertKvRecord(
  a: Assert,
  value: unknown,
  label: string
): asserts value is KvRecord {
  assertKeywordRecord(a, value as Record<string, unknown>, label);
}

/**
 * Normalizes a DB/driver payload (parsed jsonb object or legacy JSON text) into
 * a validated {@link KvRecord}.
 *
 * `JSON.parse` and the failure-path `a.fail` always run; only the per-key
 * record validation honors `a.isEnabled()` (because the parsed shape must be
 * something we can return to the caller either way).
 */
export function parseKvRecordFromUnknown(
  a: Assert,
  raw: unknown,
  label: string
): KvRecord {
  let v: unknown = raw;
  if (typeof v === 'string') {
    const s = v;
    try {
      v = JSON.parse(s) as unknown;
    } catch {
      a.fail(`${label}: JSON parse failed`, {
        raw: s.slice(0, 200),
      });
    }
  }
  assertKvRecord(a, v, label);
  return v as KvRecord;
}

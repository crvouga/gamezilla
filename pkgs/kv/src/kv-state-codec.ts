/**
 * Typed codecs that translate between a TypeScript value and a single-row
 * {@link KvRecord} for {@link useKvState}.
 *
 * Convention: each preference owns its own row keyed by a unique namespaced
 * {@link Keyword} (e.g. `ui.prefs/speaking-avatar-muted`) and stores its
 * scalar under a shared attribute key (`ui.prefs/value`). `decode` returns
 * `undefined` to signal "fall back to the hook's `default`" instead of
 * throwing — the React layer must stay tolerant of malformed persisted data.
 */
import { hotAssert } from '@pkgs/assert';
import type { Keyword } from '@pkgs/keyword/keyword';

import { assertKvRecord } from './assert-kv-record';
import type { KvRecord } from './interface';

export type KvStateCodec<T> = {
  /** Decode a stored record. Return `undefined` to fall back to the hook's `default`. */
  decode: (record: KvRecord) => T | undefined;
  /** Encode the value into a single-row {@link KvRecord}. */
  encode: (value: T) => KvRecord;
};

function makeRecord(valueAttr: Keyword, value: unknown, label: string): KvRecord {
  const record = { [valueAttr]: value } as KvRecord;
  assertKvRecord(hotAssert(), record, label);
  return record;
}

/** Boolean preference (e.g. `muted`). */
export function booleanKvCodec(valueAttr: Keyword): KvStateCodec<boolean> {
  return {
    decode(record) {
      const v = record[valueAttr];
      return typeof v === 'boolean' ? v : undefined;
    },
    encode(value) {
      return makeRecord(valueAttr, value, 'booleanKvCodec encode');
    },
  };
}

/** Closed-set string preference (e.g. theme `light` | `dark` | `system`). */
export function enumKvCodec<T extends string>(
  valueAttr: Keyword,
  allowed: readonly T[]
): KvStateCodec<T> {
  const allowedSet = new Set<string>(allowed);
  return {
    decode(record) {
      const v = record[valueAttr];
      if (typeof v !== 'string') return undefined;
      if (!allowedSet.has(v)) return undefined;
      return v as T;
    },
    encode(value) {
      return makeRecord(valueAttr, value, 'enumKvCodec encode');
    },
  };
}

/**
 * Arbitrary JSON-serializable value validated by a caller-supplied type guard.
 * The guard runs at decode time on whatever was previously persisted, so it
 * MUST reject anything that isn't shape-compatible with `T`.
 */
export function jsonKvCodec<T>(
  valueAttr: Keyword,
  isT: (v: unknown) => v is T
): KvStateCodec<T> {
  return {
    decode(record) {
      const v = record[valueAttr];
      return isT(v) ? v : undefined;
    },
    encode(value) {
      return makeRecord(valueAttr, value, 'jsonKvCodec encode');
    },
  };
}

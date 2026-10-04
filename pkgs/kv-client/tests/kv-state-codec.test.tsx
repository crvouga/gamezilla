import { describe, expect, test } from 'bun:test';
import { asKeyword, asKeywordRecord } from '@pkgs/keyword-shared/keyword';
import { decodePersistedRecord } from '@pkgs/kv-client/solid';
import { KvImplInMemory } from '@pkgs/kv-shared/impl-in-memory';
import {
  booleanKvCodec,
  enumKvCodec,
  jsonKvCodec,
} from '@pkgs/kv-shared/kv-state-codec';

const VALUE_ATTR = asKeyword('ui.prefs/value');
const ROW_KEY = asKeyword('ui.prefs/test-row');

describe('booleanKvCodec', () => {
  const codec = booleanKvCodec(VALUE_ATTR);

  test('encode round-trips through assertKvRecord', () => {
    const record = codec.encode(true);
    expect(codec.decode(record)).toBe(true);
  });

  test('encode false round-trips', () => {
    expect(codec.decode(codec.encode(false))).toBe(false);
  });

  test('decode returns undefined when attr is missing', () => {
    const record = asKeywordRecord({ 'ui.prefs/other': true }, 'missing attr');
    expect(codec.decode(record)).toBeUndefined();
  });

  test('decode returns undefined when attr is non-boolean', () => {
    const record = asKeywordRecord({ 'ui.prefs/value': 'yes' }, 'non-boolean');
    expect(codec.decode(record)).toBeUndefined();
  });
});

describe('enumKvCodec', () => {
  const allowed = ['light', 'dark', 'system'] as const;
  const codec = enumKvCodec<(typeof allowed)[number]>(VALUE_ATTR, allowed);

  test('encode + decode every allowed value', () => {
    for (const v of allowed) {
      expect(codec.decode(codec.encode(v))).toBe(v);
    }
  });

  test('decode rejects values outside the allowed set', () => {
    const record = asKeywordRecord({ 'ui.prefs/value': 'sepia' }, 'bad enum');
    expect(codec.decode(record)).toBeUndefined();
  });

  test('decode rejects non-string values', () => {
    const record = asKeywordRecord({ 'ui.prefs/value': 1 }, 'non-string enum');
    expect(codec.decode(record)).toBeUndefined();
  });
});

describe('jsonKvCodec', () => {
  type Pair = { a: number; b: string };
  const isPair = (v: unknown): v is Pair =>
    typeof v === 'object' &&
    v !== null &&
    typeof (v as Pair).a === 'number' &&
    typeof (v as Pair).b === 'string';
  const codec = jsonKvCodec<Pair>(VALUE_ATTR, isPair);

  test('encode + decode preserves shape', () => {
    const value: Pair = { a: 1, b: 'two' };
    expect(codec.decode(codec.encode(value))).toEqual(value);
  });

  test('decode rejects values that fail the type guard', () => {
    const record = asKeywordRecord(
      { 'ui.prefs/value': { a: 'no' } },
      'bad json'
    );
    expect(codec.decode(record)).toBeUndefined();
  });
});

describe('decodePersistedRecord', () => {
  const codec = booleanKvCodec(VALUE_ATTR);

  test('returns null when record is null', () => {
    expect(decodePersistedRecord(null, codec)).toBeNull();
  });

  test('returns null when codec rejects the record', () => {
    const record = asKeywordRecord({ 'ui.prefs/value': 'nope' }, 'bad');
    expect(decodePersistedRecord(record, codec)).toBeNull();
  });

  test('returns the decoded value when codec accepts it', () => {
    expect(decodePersistedRecord(codec.encode(true), codec)).toBe(true);
  });
});

describe('KV state round-trip via KvImplInMemory', () => {
  const codec = booleanKvCodec(VALUE_ATTR);

  test('persisted value can be hydrated by a fresh codec read', async () => {
    const kv = new KvImplInMemory();
    await kv.put(ROW_KEY, codec.encode(true));
    const record = await kv.get(ROW_KEY);
    expect(decodePersistedRecord(record, codec)).toBe(true);
  });

  test('write then overwrite then read returns latest value', async () => {
    const kv = new KvImplInMemory();
    await kv.put(ROW_KEY, codec.encode(true));
    await kv.put(ROW_KEY, codec.encode(false));
    const record = await kv.get(ROW_KEY);
    expect(decodePersistedRecord(record, codec)).toBe(false);
  });
});

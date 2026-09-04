import { describe, expect, test } from 'bun:test';
import { assert } from '@pkgs/assert';
import { asKeyword } from '@pkgs/keyword/keyword';
import { parseKvRecordFromUnknown } from './assert-kv-record';
import { KvImplInMemory } from './impl-in-memory';
import { runKvContractTests } from './kv-contract';

describe('parseKvRecordFromUnknown', () => {
  test('parses JSON string with keyword keys into KvRecord', () => {
    const r = parseKvRecordFromUnknown(
      assert,
      '{"kv.contract/value":"1"}',
      'parseKvRecordFromUnknown test'
    );
    expect(r[asKeyword('kv.contract/value')]).toBe('1');
  });
});

/** Fake-tier port suite (in-memory). Real Postgres: `@pkgs/kv-postgres`. */
describe('KvImplInMemory (port suite)', () => {
  runKvContractTests(() => new KvImplInMemory());
});

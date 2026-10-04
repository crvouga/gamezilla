import { describe, expect, test } from 'bun:test';
import { assert } from '@pkgs/assert-shared/singleton';
import { asKeyword } from '@pkgs/keyword-shared/keyword';
import { parseKvRecordFromUnknown } from '@pkgs/kv-shared/assert-kv-record';
import { KvImplInMemory } from '@pkgs/kv-shared/impl-in-memory';
import { runKvContractTests } from '@pkgs/kv-shared/kv-contract';

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

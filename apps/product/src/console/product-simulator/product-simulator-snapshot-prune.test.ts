import { describe, expect, test } from 'bun:test';
import {
  measureSnapshotTreeBytes,
  toSnapshotInfo,
} from '@apps/product/product-simulator/product-simulator-snapshot-prune';
import { productSimulatorSnapshotInfoSchema } from '@apps/product/product-simulator/product-simulator-snapshot-schema';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';

describe('measureSnapshotTreeBytes', () => {
  test('sums StoredObject.size under snapshots/{id}/', async () => {
    const store = new ObjectStoreImplInMemory();
    const a = new TextEncoder().encode('aaa');
    const b = new TextEncoder().encode('bbbb');
    await store.put('snapshots/s1/sql/server.bin', a, 'application/json');
    await store.put('snapshots/s1/manifest.json', b, 'application/json');
    await store.put(
      'snapshots/other/manifest.json',
      new TextEncoder().encode('x'),
      'application/json'
    );
    expect(await measureSnapshotTreeBytes(store, 's1')).toBe(
      a.byteLength + b.byteLength
    );
  });
});

describe('toSnapshotInfo', () => {
  test('includes totalBytes when provided', () => {
    const info = toSnapshotInfo(
      {
        version: 2,
        localSchemaVersion: 0,
        id: 's1',
        label: 'Snap',
        createdAtMs: 1,
      },
      4096
    );
    expect(info.totalBytes).toBe(4096);
    expect(productSimulatorSnapshotInfoSchema.safeParse(info).success).toBe(
      true
    );
  });

  test('omits totalBytes when not provided', () => {
    const info = toSnapshotInfo({
      version: 2,
      localSchemaVersion: 0,
      id: 's1',
      label: 'Snap',
      createdAtMs: 1,
    });
    expect(info.totalBytes).toBeUndefined();
  });
});

describe('productSimulatorSnapshotInfoSchema', () => {
  test('accepts legacy index rows without totalBytes', () => {
    expect(
      productSimulatorSnapshotInfoSchema.safeParse({
        id: 's1',
        label: 'Snap',
        createdAtMs: 1,
      }).success
    ).toBe(true);
  });

  test('accepts totalBytes', () => {
    expect(
      productSimulatorSnapshotInfoSchema.safeParse({
        id: 's1',
        label: 'Snap',
        createdAtMs: 1,
        totalBytes: 128,
      }).success
    ).toBe(true);
  });
});

import { expect, test } from 'bun:test';
import { resolve } from 'node:path';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server/wall-node-fs';
import {
  createUIQualityChecker,
  setup,
} from '@pkgs/ui-quality-check-server/api';

test('explicit offline setup retries corrupt installations and rejects unpinned checkpoints', async () => {
  // regression: ui-quality-setup-corrupt-repair — existing broken graph/weights, supplied local checkpoint.
  const modelDir = resolve('.cache/setup-corrupt');
  const store = createNodeFsObjectStore({
    rootDir: modelDir,
    fs: wallNodeFs(),
    layout: 'tree',
  });
  await store.put(
    'vision.onnx',
    new Uint8Array([1, 2, 3]),
    'application/octet-stream'
  );
  await store.put(
    'vision.data',
    new Uint8Array([4, 5, 6]),
    'application/octet-stream'
  );
  try {
    await expect(createUIQualityChecker({ modelDir })).rejects.toThrow(
      'Model missing or corrupt'
    );
    await expect(
      setup({ modelDir, sourcePath: 'fixtures/evaluation/good/desktop.png' })
    ).rejects.toThrow('SHA256 or length mismatch');
    const retained = await store.get('vision.data');
    expect(retained?.size).toBe(3);
    if (retained) await retained.body.cancel();
  } finally {
    await store.deleteMany(await store.listKeys());
  }
});

test('an aborted setup cannot perform disk or network preparation', async () => {
  const cancellation = new AbortController();
  cancellation.abort(new Error('stop setup'));
  await expect(
    setup({ signal: cancellation.signal, sourcePath: 'absent.safetensors' })
  ).rejects.toThrow('stop setup');
});

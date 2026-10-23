import { expect, test } from 'bun:test';
import { relative, resolve } from 'node:path';
import { createNodeFsObjectStore } from '@pkgs/object-store-node-fs-server-ts/impl-node-fs';
import { wallNodeFs } from '@pkgs/object-store-node-fs-server-ts/wall-node-fs';
import {
  checkImage,
  createUIQualityChecker,
} from '@pkgs/ui-quality-check-server-ts/api';
import { detector, options } from './support';

const store = createNodeFsObjectStore({
  rootDir: resolve('.cache/unit-evidence'),
  fs: wallNodeFs(),
  layout: 'tree',
});

test('a cache hit avoids inference, and changed thresholds produce separate results', async () => {
  await store.deleteMany(await store.listKeys());
  const model = detector('fixture-score', 0.8);
  const checker = await createUIQualityChecker({
    ...options(model.value),
    cacheDir: resolve('.cache/unit-evidence/cache'),
  });
  const input = resolve('fixtures/evaluation/good/desktop.png');
  try {
    const first = await checker.checkImage(input);
    const second = await checker.checkImage(input);
    expect(first).toEqual(second);
    expect(model.calls.length).toBe(1);
    expect(first.cacheKey).toMatch(/^[a-f0-9]{64}$/);
  } finally {
    await checker.dispose();
  }
  const changed = await checkImage(input, {
    ...options(detector('fixture-score', 0.8).value),
    threshold: 0.99,
    cacheDir: resolve('.cache/unit-evidence/cache'),
  });
  expect(changed.pass).toBe(false);
  expect((await store.listKeys('cache/')).length).toBe(2);
});

test('corrupt cached evidence is recomputed and failure artifacts contain actual pixels', async () => {
  await store.deleteMany(await store.listKeys('corrupt-cache/'));
  const model = detector('fixture-score', 0.8);
  const cacheDir = resolve('.cache/unit-evidence/corrupt-cache');
  const checker = await createUIQualityChecker({
    ...options(model.value),
    threshold: 0.99,
    cacheDir,
    artifactsDir: resolve('.cache/unit-evidence/artifacts'),
  });
  try {
    const first = await checker.checkImage(
      resolve('fixtures/evaluation/good/desktop.png')
    );
    const key = first.cacheKey;
    if (!key) throw new Error('Expected cache key.');
    await store.put(
      `corrupt-cache/${key}.json`,
      new TextEncoder().encode('{invalid'),
      'application/json'
    );
    const second = await checker.checkImage(
      resolve('fixtures/evaluation/good/desktop.png')
    );
    expect(model.calls.length).toBe(2);
    expect(second.pass).toBe(false);
    const artifact = second.worstFrames[0]?.artifact;
    expect(artifact).toBeDefined();
    if (!artifact) throw new Error('Expected frame artifact.');
    const png = await store.get(
      relative(resolve('.cache/unit-evidence'), artifact).replaceAll('\\', '/')
    );
    if (!png) throw new Error('Expected emitted PNG.');
    const bytes = new Uint8Array(await new Response(png.body).arrayBuffer());
    expect([...bytes.slice(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  } finally {
    await checker.dispose();
  }
});

test('mixed-directory discovery scores supported screenshots in deterministic path order', async () => {
  const model = detector('fixture-score', 0.8);
  const checker = await createUIQualityChecker(options(model.value));
  try {
    const result = await checker.check(['fixtures/evaluation/good']);
    expect(result.results.length).toBe(8);
    expect(model.calls).toEqual([8]);
    expect(result.results.map((r) => r.input)).toEqual(
      [...result.results.map((r) => r.input)].sort()
    );
    await expect(checker.check(['fixtures/corpus.json'])).rejects.toThrow(
      'No supported'
    );
  } finally {
    await checker.dispose();
  }
});

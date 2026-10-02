import { expect, test } from 'bun:test';
import { collectArtifacts } from '@apps/product/ui-quality/collect';
import { runVisualGate } from '@apps/product/ui-quality/gate';
import { snapshotDocument } from '@apps/product/ui-quality/render';
import {
  failureSummary,
  writeQualityReports,
  writeToolingFailure,
} from '@apps/product/ui-quality/report';
import sources from '@apps/product/ui-quality/sources.json';
import type { ArtifactManifest } from '@apps/product/ui-quality/types';
import { readFrameBody, readTestReport, sourceId } from '@pkgs/harness-report';
import { publishSource } from '@pkgs/harness-report/remote/publish';
import {
  readObjectBytes,
  readUtf8,
  writeUtf8,
} from '@pkgs/object-store/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { assertProperty, fc } from '@pkgs/property';
import type {
  ImageInput,
  QualityResult,
  UIQualityChecker,
} from 'ui-quality-check';

const createMemObjectStore = () => new ObjectStoreImplInMemory();

function report(files: readonly string[]) {
  return {
    meta: {
      testId: 'fixture',
      title: 'Fixture',
      startedAtMs: 10,
      sourceFile: 'specs/example.feature',
    },
    steps: [
      {
        title: 'Open a dialog',
        steps: [],
        frames: files.map((file, index) => ({
          capturedAtMs: 20 + index,
          snapshots: [{ file, media: 'html', nodeId: 'alice' }],
        })),
      },
    ],
  };
}

async function source(files: readonly string[]) {
  const store = createMemObjectStore();
  await writeUtf8(store, 'complete.json', '{"status":0}');
  await writeUtf8(
    store,
    'runs/latest/tests/fixture/report.json',
    JSON.stringify(report(files))
  );
  for (const file of new Set(files))
    await writeUtf8(
      store,
      `runs/latest/tests/fixture/${file}`,
      `<html><head></head><body>${file}</body></html>`
    );
  return { package: '@apps/example', bucket: 'part-0', store };
}

test('recorded states are scored once without losing any scenario references', async () => {
  await assertProperty(
    'artifact deduplication conserves references',
    fc.asyncProperty(
      fc.array(fc.integer({ min: 0, max: 10 }), {
        minLength: 1,
        maxLength: 35,
      }),
      async (ids) => {
        const files = ids.map((id) => `frames/${id}.html`);
        const output = createMemObjectStore();
        const manifest = await collectArtifacts([await source(files)], output);
        expect(manifest.references).toBe(ids.length);
        expect(manifest.artifacts.length).toBe(new Set(ids).size);
        expect(manifest.artifacts.flatMap((a) => a.origins)).toHaveLength(
          ids.length
        );
        expect(
          manifest.artifacts
            .flatMap((a) => a.origins)
            .every((o) => o.actor === 'alice' && o.step === 'Open a dialog')
        ).toBe(true);
      }
    )
  );
});

test('missing, failed and empty evidence cannot produce a passing gate', async () => {
  const s = await source(['frames/a.html']);
  await s.store.delete('runs/latest/tests/fixture/frames/a.html');
  await expect(collectArtifacts([s], createMemObjectStore())).rejects.toThrow(
    'Missing UI artifact'
  );
  await s.store.delete('complete.json');
  await expect(collectArtifacts([s], createMemObjectStore())).rejects.toThrow(
    'completion'
  );
  await writeUtf8(s.store, 'complete.json', '{"status":1}');
  await expect(collectArtifacts([s], createMemObjectStore())).rejects.toThrow(
    'completion'
  );
  await expect(
    collectArtifacts([await source([])], createMemObjectStore())
  ).rejects.toThrow('empty pass');
});

test('existing video artifacts are included alongside recorded HTML', async () => {
  const s = await source(['frames/a.html']);
  await s.store.put(
    'runs/latest/tests/fixture/recording.webm',
    new Uint8Array([1]),
    'video/webm'
  );
  const manifest = await collectArtifacts([s], createMemObjectStore());
  expect(manifest.artifacts.map((a) => a.kind).sort()).toEqual([
    'html',
    'video',
  ]);
  expect(
    manifest.artifacts.find((a) => a.kind === 'video')?.origins[0]
  ).toMatchObject({
    test: 'fixture',
    title: 'Fixture',
    source: 'specs/example.feature',
  });
});

test('report paths cannot escape their artifact bucket', async () => {
  const s = await source([]);
  await writeUtf8(
    s.store,
    'runs/latest/tests/fixture/report.json',
    JSON.stringify(report(['../../outside.html']))
  );
  await expect(collectArtifacts([s], createMemObjectStore())).rejects.toThrow(
    'Invalid report artifact path'
  );
});

test('snapshot replay strips active resources and injects the local stylesheet', () => {
  const html = snapshotDocument(
    '<html><head><link href="https://fonts.example/x"><script>fetch("https://example")</script></head><body>UI</body></html>',
    '.ui{color:red}'
  );
  expect(html).not.toContain('<script');
  expect(html).not.toContain('<link');
  expect(html).toContain("default-src 'none'");
  expect(html).toContain('.ui{color:red}');
  expect(() => snapshotDocument('<div>no document</div>', '')).toThrow(
    'document head'
  );
});

function quality(pass: boolean): QualityResult {
  return {
    schemaVersion: 1,
    packageVersion: '0.1.0',
    summary: '',
    kind: 'image',
    input: '<memory>',
    pass,
    score: pass ? 0.8 : 0.2,
    worstScore: pass ? 0.8 : 0.2,
    threshold: 0.5,
    thresholdSource: 'explicit',
    framesAnalyzed: 1,
    candidateFrames: 1,
    framesDeduplicated: 0,
    framesSkippedEmpty: 0,
    framesSkippedIgnored: 0,
    durationMs: 0,
    frames: [],
    worstFrames: [],
    failures: [],
    detectors: [],
  };
}

test('the gate batches every unique state and persists failure diagnostics', async () => {
  const input = createMemObjectStore();
  const manifest = await collectArtifacts(
    [await source(['frames/a.html', 'frames/b.html', 'frames/c.html'])],
    input
  );
  const output = createMemObjectStore();
  const batches: number[] = [];
  const checker: Pick<UIQualityChecker, 'checkImages' | 'checkVideos'> = {
    async checkImages(images: readonly ImageInput[]) {
      batches.push(images.length);
      const results = images.map((_, index) => quality(index !== 0));
      return { schemaVersion: 1 as const, pass: false, summary: '', results };
    },
    async checkVideos() {
      throw new Error('Unexpected video');
    },
  };
  const result = await runVisualGate(manifest, {
    inputs: input,
    output,
    checker,
    renderer: {
      render: async (html) => new TextEncoder().encode(html),
      dispose() {},
    },
    inputPath: (file) => file,
    diagnosticKey: (file) => file,
    threshold: 0.5,
    batchSize: 2,
  });
  expect(batches).toEqual([2, 1]);
  expect(result.pass).toBe(false);
  expect(result.inputsAnalyzed).toBe(3);
  expect(result.results.filter((r) => r.failureImage)).toHaveLength(2);
  expect(await readUtf8(output, 'result.json')).toContain('Open a dialog');
  expect((await output.listKeys('failures/')).length).toBe(2);
  await verifyPublishedFailure(result, output);
});

async function verifyPublishedFailure(
  result: Awaited<ReturnType<typeof runVisualGate>>,
  output: ObjectStoreImplInMemory
) {
  const reports = createMemObjectStore();
  await writeQualityReports(result, output, reports);
  const remote = createMemObjectStore();
  await publishSource(remote, {
    local: reports,
    sha: 'a'.repeat(40),
    packageDir: 'apps/product',
    bucket: 'ui-quality',
    status: 'failed',
  });
  const failed = result.results.find((s) => s.failureImage)!;
  const args = {
    sha: 'a'.repeat(40),
    source: sourceId('apps/product', 'ui-quality'),
    testId: failed.artifact.hash,
  };
  const published = await readTestReport(remote, args);
  expect(published?.meta.status).toBe('failed');
  expect(published?.steps[0]?.detail).toContain('Open a dialog');
  expect(
    (await readFrameBody(remote, { ...args, file: 'frames/worst.png' }))?.bytes
  ).toEqual((await readObjectBytes(output, failed.failureImage!))!);
}

test('an empty prepared manifest fails before invoking a detector', async () => {
  const manifest: ArtifactManifest = {
    schemaVersion: 1,
    artifacts: [],
    references: 0,
    reports: 0,
  };
  await expect(runVisualGate(manifest, {} as never)).rejects.toThrow(
    'empty pass'
  );
});

test('tooling failures are visible in the same report viewer as visual failures', async () => {
  const store = createMemObjectStore();
  await writeToolingFailure(store, new Error('Model checksum mismatch'));
  const report = JSON.parse(
    (await readUtf8(store, 'runs/latest/tests/tooling/report.json'))!
  ) as { meta: { status: string; error: string } };
  expect(report.meta).toMatchObject({
    status: 'failed',
    error: 'Model checksum mismatch',
  });
});

test('video failures preserve the decoder timestamp and extracted PNG in the shared report', async () => {
  // regression: ui-quality-reported-video-timestamp — original scenario reference is 0, inspected frame is 7433.
  const inputs = createMemObjectStore();
  const s = await source([]);
  await s.store.put('recording.webm', new Uint8Array([1]), 'video/webm');
  const manifest = await collectArtifacts([s], inputs);
  const output = createMemObjectStore();
  await output.put('videos/worst.png', new Uint8Array([2]), 'image/png');
  const result = await runVisualGate(manifest, {
    inputs,
    output,
    renderer: {
      async render() {
        throw new Error('Unexpected replay');
      },
      dispose() {},
    },
    checker: {
      async checkImages() {
        throw new Error('Unexpected image');
      },
      async checkVideos(paths) {
        expect(paths).toEqual([manifest.artifacts[0]!.file]);
        const result = {
          ...quality(false),
          kind: 'video' as const,
          worstFrames: [
            {
              timestampMs: 7433,
              quality: 0.2,
              detectorScores: [],
              artifact: '/diagnostics/videos/worst.png',
            },
          ],
        };
        return {
          schemaVersion: 1,
          pass: false,
          summary: '',
          results: [result],
        };
      },
    },
    inputPath: (file) => file,
    diagnosticKey: (path) => path.replace('/diagnostics/', ''),
    threshold: 0.5,
    batchSize: 2,
  });
  const reports = createMemObjectStore();
  await writeQualityReports(result, output, reports);
  const key = (await reports.listKeys()).find((k) =>
    k.endsWith('/report.json')
  )!;
  expect(await readUtf8(reports, key)).toContain('7433');
  expect(failureSummary(result.results[0]!, result.threshold)).toContain(
    '@ 7433ms'
  );
  expect(
    await readObjectBytes(
      reports,
      key.replace('report.json', 'frames/worst.png')
    )
  ).toEqual(new Uint8Array([2]));
});

test('configured source order is deterministic', () => {
  expect(sources.map((s) => s.directory)).toEqual(
    [...sources.map((s) => s.directory)].sort()
  );
});

test('different recorded documents with identical rendered pixels reuse inference across batches', async () => {
  const input = createMemObjectStore();
  const manifest = await collectArtifacts(
    [await source(['frames/a.html', 'frames/b.html'])],
    input
  );
  let scored = 0;
  const result = await runVisualGate(manifest, {
    inputs: input,
    output: createMemObjectStore(),
    renderer: { render: async () => new Uint8Array([1]), dispose() {} },
    checker: {
      async checkImages(images) {
        scored += images.length;
        return {
          schemaVersion: 1,
          pass: true,
          summary: '',
          results: images.map(() => quality(true)),
        };
      },
      async checkVideos() {
        throw new Error('Unexpected video');
      },
    },
    inputPath: (file) => file,
    diagnosticKey: (file) => file,
    threshold: 0.5,
    batchSize: 1,
  });
  expect(scored).toBe(1);
  expect(result.uniqueImagesScored).toBe(1);
  expect(result.results).toHaveLength(2);
  expect(result.results.flatMap((r) => r.artifact.origins)).toHaveLength(2);
});

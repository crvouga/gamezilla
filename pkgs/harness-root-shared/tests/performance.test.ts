import { expect, test } from 'bun:test';
import type { RunReport } from '@crvouga/atlas-reports/report-types';
import { readUtf8 } from '@pkgs/object-store-root-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-root-shared/impl-in-memory';
import { exampleApp, put } from './example-app';

test('performance separates virtual time, nested execution and snapshot overhead', async () => {
  let elapsed = 0;
  const sys = exampleApp({
    onCapture: () => {
      elapsed += 100;
    },
  });
  const store = new ObjectStoreImplInMemory();
  const s = await sys.run({
    seed: 1,
    report: {
      store,
      runId: 'measured',
      testId: 'counter',
      performance: { clock: { now: () => elapsed }, slowStepMs: 50 },
    },
  });
  try {
    await s.record({ kind: 'When', title: 'nested action' }, async () => {
      elapsed += 5;
      await s.record(
        { kind: 'ui', title: 'press', snapshotBefore: true },
        async () => {
          elapsed += 60;
          await s.advanceTime(10_000);
        }
      );
      elapsed += 5;
    });
    const report = s.report()!;
    const parent = report.steps[0]!;
    expect(parent.steps[0]?.performance).toEqual({
      executionMs: 60,
      selfMs: 60,
      snapshotMs: 100,
    });
    expect(parent.performance).toEqual({
      executionMs: 170,
      selfMs: 10,
      snapshotMs: 100,
    });
    expect(report.meta.performance).toMatchObject({
      executionMs: 70,
      snapshotMs: 200,
      measuredSteps: 2,
      slowSteps: 1,
      slowStepMs: 50,
    });
  } finally {
    await s[Symbol.asyncDispose]();
  }
  const saved = JSON.parse(
    (await readUtf8(store, 'runs/measured/tests/counter/report.json'))!
  ) as RunReport;
  expect(saved.steps[0]?.steps[0]?.performance?.selfMs).toBe(60);
});

test('a failing operation still records its elapsed execution time', async () => {
  let elapsed = 0;
  await using s = await exampleApp().run({
    seed: 1,
    report: {
      frames: false,
      performance: { clock: { now: () => elapsed }, slowStepMs: 50 },
    },
  });
  await expect(
    s.record({ kind: 'When', title: 'failure' }, async () => {
      elapsed += 51;
      throw new Error('failed');
    })
  ).rejects.toThrow('failed');
  expect(s.report()?.steps[0]?.performance).toEqual({
    executionMs: 51,
    selfMs: 51,
    snapshotMs: 0,
  });
  expect(s.report()?.meta.performance?.slowSteps).toBe(1);
});

test('reports without an injected measurement clock never invent timings', async () => {
  await using s = await exampleApp().run({ seed: 1, report: true });
  await s.apply(put, 'x', '1');
  expect(s.report()?.steps[0]?.performance).toBeUndefined();
  expect(s.report()?.meta.performance).toBeUndefined();
});

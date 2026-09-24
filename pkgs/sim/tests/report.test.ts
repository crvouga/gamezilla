import { describe, expect, test } from 'bun:test';
import { readUtf8 } from '@pkgs/object-store/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';

import {
  defineAction,
  defineRuntime,
  defineSnapshot,
  defineSystem,
  RUNS_INDEX_KEY,
  runManifestKey,
  testReportKey,
  virtualTimeRuntime,
} from '../src/index';

type Kv = { values: Record<string, string>; clients: string[] };

function makeKv() {
  const put = defineAction({
    name: 'put',
    act: (s: Kv, key: string, value: string) => {
      s.values[key] = value;
    },
  });
  const sys = defineSystem({
    name: 'report-kv',
    create: (): Kv => ({ values: {}, clients: ['alice', 'bob'] }),
    runtimes: [
      defineRuntime({
        default: true,
        name: 'virtual',
        create: () => virtualTimeRuntime(),
      }),
    ],
    actions: [put],
    snapshots: [
      defineSnapshot({
        name: 'store',
        capture: (s: Kv) => ({ ...s.values }),
      }),
      defineSnapshot({
        name: 'html',
        media: 'html',
        capture: (s: Kv) => {
          const map: Record<string, string> = {};
          for (const id of s.clients) {
            map[id] = `<html><body>${id}:${s.values['x'] ?? ''}</body></html>`;
          }
          return map;
        },
      }),
    ],
  });
  return { sys, put };
}

describe('run reporting', () => {
  test('report: false leaves report() null', async () => {
    const { sys, put } = makeKv();
    await using s = await sys.run({ seed: 1 });
    await s.apply(put, 'x', '1');
    expect(s.report()).toBeNull();
  });

  test('apply captures frames when report: true', async () => {
    const { sys, put } = makeKv();
    await using s = await sys.run({ seed: 1, report: true });
    await s.apply(put, 'x', '1');
    const report = s.report();
    expect(report).not.toBeNull();
    expect(report!.steps).toHaveLength(1);
    expect(report!.steps[0]!.kind).toBe('apply');
    expect(report!.steps[0]!.title).toBe('put("x", "1")');
    expect(report!.steps[0]!.frames.length).toBeGreaterThanOrEqual(1);
    const snaps = report!.steps[0]!.frames[0]!.snapshots;
    expect(snaps.some((b) => b.name === 'store' && b.media === 'json')).toBe(
      true
    );
    expect(snaps.filter((b) => b.name === 'html').length).toBe(2);
  });

  test('record coalesces nested advanceTime into one step', async () => {
    const { sys } = makeKv();
    await using s = await sys.run({ seed: 1, report: true });
    await s.record(
      { kind: 'waitFor', title: 'expect.visible', actorId: 'alice' },
      async () => {
        await s.advanceTime(50);
        await s.advanceTime(50);
      }
    );
    const report = s.report()!;
    expect(report.steps).toHaveLength(1);
    expect(report.steps[0]!.kind).toBe('waitFor');
    expect(report.steps[0]!.actorId).toBe('alice');
  });

  test('nested record / apply become child steps', async () => {
    const { sys, put } = makeKv();
    await using s = await sys.run({ seed: 1, report: true });
    await s.record({ kind: 'scenario', title: 'outer' }, async () => {
      await s.record({ kind: 'ui', title: 'tap', selector: 'x' }, () =>
        Promise.resolve()
      );
      await s.apply(put, 'x', '1');
    });
    const report = s.report()!;
    expect(report.steps).toHaveLength(1);
    const outer = report.steps[0]!;
    expect(outer.steps.map((c) => c.title)).toEqual(['tap', 'put("x", "1")']);
    expect(outer.steps[0]!.selector).toBe('x');
    expect(outer.steps[1]!.kind).toBe('apply');
  });

  test('press hit lands only on the pre-action frame, even when unchanged', async () => {
    const { sys, put } = makeKv();
    await using s = await sys.run({ seed: 1, report: true });
    await s.apply(put, 'x', '1');
    const hit = { path: ['home', 'ok'], point: { xRatio: 0.5, yRatio: 0.5 } };
    await s.record(
      { kind: 'ui', title: 'tap', hit, snapshotBefore: true },
      async () => {
        await s.apply(put, 'x', '2');
      }
    );
    const report = s.report()!;
    const tap = report.steps[1]!;
    // UI did not change since the last apply, yet the press keeps its frame.
    expect(tap.frames[0]!.hit).toEqual(hit);
    expect(tap.frames[0]!.snapshots).toEqual(
      report.steps[0]!.frames.at(-1)!.snapshots
    );
    const after = tap.steps[0]!.frames;
    expect(after.length).toBeGreaterThan(0);
    expect(after.every((f) => f.hit === undefined)).toBe(true);
  });

  test('describe names the apply step; failures mark the run', async () => {
    const boom = defineAction({
      name: 'boom',
      describe: (who: string) => `explode ${who}`,
      act: (_s: Kv, _who: string) => {
        throw new Error('kaboom');
      },
    });
    const { sys, put } = makeKv();
    const withBoom = defineSystem({
      name: 'report-kv-boom',
      create: (): Kv => ({ values: {}, clients: [] }),
      runtimes: [
        defineRuntime({
          default: true,
          name: 'virtual',
          create: () => virtualTimeRuntime(),
        }),
      ],
      actions: [put, boom],
    });
    void sys;
    await using s = await withBoom.run({ seed: 1, report: true });
    await expect(s.apply(boom, 'alice')).rejects.toThrow('kaboom');
    const report = s.report()!;
    expect(report.steps[0]!.title).toBe('explode alice');
    expect(report.steps[0]!.status).toBe('failed');
    expect(report.steps[0]!.error).toBe('kaboom');
    expect(report.meta.status).toBe('failed');
    expect(report.meta.error).toBe('kaboom');
  });

  test('fail() records a harness failure outside any step', async () => {
    const { sys, put } = makeKv();
    await using s = await sys.run({ seed: 1, report: true });
    await s.apply(put, 'x', '1');
    s.fail(new Error('assertion in test body'));
    expect(s.report()!.meta.status).toBe('failed');
    expect(s.report()!.meta.error).toBe('assertion in test body');
  });

  test('persists report.json to ObjectStore on dispose', async () => {
    const store = new ObjectStoreImplInMemory();
    const { sys, put } = makeKv();
    {
      await using s = await sys.run({
        seed: 7,
        report: {
          store,
          runId: 'latest_run',
          testId: 'kv-put',
          now: () => 1_000,
        },
      });
      await s.apply(put, 'x', 'hi');
    }
    const key = testReportKey('latest_run', 'kv-put');
    const text = await readUtf8(store, key);
    expect(text).not.toBeNull();
    const parsed = JSON.parse(text!) as {
      meta: { testId: string; status: string };
      steps: unknown[];
    };
    expect(parsed.meta.testId).toBe('kv-put');
    expect(parsed.meta.status).toBe('passed');
    expect(parsed.steps).toHaveLength(1);
    const manifest = JSON.parse(
      (await readUtf8(store, runManifestKey('latest_run')))!
    ) as { tests: { testId: string; title: string; frameCount: number }[] };
    expect(manifest.tests[0]!.title).toBe('kv-put');
    expect(manifest.tests[0]!.frameCount).toBeGreaterThan(0);
    const indexText = await readUtf8(store, RUNS_INDEX_KEY);
    expect(indexText).not.toBeNull();
    const index = JSON.parse(indexText!) as {
      runs: { id: string }[];
    };
    expect(index.runs.some((r) => r.id === 'latest_run')).toBe(true);
  });

  test('png snapshot encodes Uint8Array', async () => {
    const bump = defineAction({
      name: 'bump',
      act: (s: { n: number }) => {
        s.n += 1;
      },
    });
    const pngBytes = new Uint8Array([137, 80, 78, 71]);
    const sys = defineSystem({
      name: 'png-sys',
      create: () => ({ n: 0 }),
      runtimes: [
        defineRuntime({
          default: true,
          name: 'virtual',
          create: () => virtualTimeRuntime(),
        }),
      ],
      actions: [bump],
      snapshots: [
        defineSnapshot({
          name: 'screen',
          media: 'png',
          capture: () => pngBytes,
        }),
      ],
    });
    const store = new ObjectStoreImplInMemory();
    await using s = await sys.run({
      seed: 1,
      report: { store, testId: 'png', runId: 'r1', now: () => 0 },
    });
    await s.apply(bump);
    const report = s.report()!;
    const blob = report.steps[0]!.frames[0]!.snapshots[0]!;
    expect(blob.media).toBe('png');
    expect(blob.file.endsWith('.png')).toBe(true);
  });
});

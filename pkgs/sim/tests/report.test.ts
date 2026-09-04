import { describe, expect, test } from 'bun:test';
import { ObjectStoreImplInMemory } from '@pkgs/object-store/impl-in-memory';
import { readUtf8 } from '@pkgs/object-store/helpers';

import {
  defineAction,
  defineRuntime,
  defineSnapshot,
  defineSystem,
  RUNS_INDEX_KEY,
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
            map[id] = `<html><body>${id}:${s.values.x ?? ''}</body></html>`;
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
    expect(report!.steps[0]!.title).toBe('put');
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

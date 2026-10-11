import { describe, expect, test } from 'bun:test';
import { fileLabel, fmtMs } from '@crvouga/atlas-reports/format';
import { orderedUiBlobs, testFrames } from '@crvouga/atlas-reports/frames';
import { buildHash, parseHash } from '@crvouga/atlas-reports/hash';
import type { HtmlReportTest } from '@crvouga/atlas-reports/recording-bundle';

describe('hash', () => {
  test('round-trips list and test routes', () => {
    const list = parseHash('#/?status=failed&q=foo');
    expect(list.view).toBe('list');
    expect(list.params['status']).toBe('failed');
    expect(list.params['q']).toBe('foo');
    expect(buildHash(list)).toBe('#/?status=failed&q=foo');

    const testRoute = parseHash('#/test/abc-123?frame=2');
    expect(testRoute.view).toBe('test');
    if (testRoute.view === 'test') {
      expect(testRoute.testId).toBe('abc-123');
      expect(testRoute.params['frame']).toBe('2');
    }
  });

  test('an aggregated report id with slashes survives the round trip', () => {
    // The reports screen prefixes ids with their source (`libs-chess--part-0/…`).
    const hash = buildHash({
      view: 'test',
      testId: 'libs/chess/monkey.monkey',
      params: {},
    });
    const route = parseHash(hash);
    expect(route.view).toBe('test');
    if (route.view === 'test') {
      expect(route.testId).toBe('libs/chess/monkey.monkey');
    }
  });
});

describe('format', () => {
  test('fmtMs and fileLabel', () => {
    expect(fmtMs(42)).toBe('42ms');
    expect(fmtMs(2500)).toBe('2.5s');
    expect(fileLabel('pkgs/harness/tests/foo.test.ts')).toBe('foo.test.ts');
    expect(fileLabel(undefined)).toBe('Other');
  });
});

describe('multi-client timeline ordering', () => {
  test('keeps actor slots stable when snapshot order changes', () => {
    const test = {
      report: {
        meta: { actorIds: ['alice', 'bob'] },
        steps: [
          {
            index: 0,
            frames: [
              {
                index: 0,
                capturedAtMs: 1,
                snapshots: [
                  { nodeId: 'alice', media: 'html', name: 'ui', file: 'a' },
                  { nodeId: 'bob', media: 'html', name: 'ui', file: 'b' },
                ],
              },
              {
                index: 1,
                capturedAtMs: 2,
                snapshots: [
                  { nodeId: 'bob', media: 'html', name: 'ui', file: 'c' },
                  { nodeId: 'alice', media: 'html', name: 'ui', file: 'd' },
                ],
              },
            ],
            steps: [],
          },
        ],
      },
      blobs: {},
    } as unknown as HtmlReportTest;

    const frames = testFrames(test);
    expect(
      orderedUiBlobs(frames[0] ?? null, test).map((entry) => entry.nodeId)
    ).toEqual(['alice', 'bob']);
    expect(
      orderedUiBlobs(frames[1] ?? null, test).map((entry) => entry.nodeId)
    ).toEqual(['alice', 'bob']);
    expect(
      orderedUiBlobs(frames[0] ?? null, test).map((entry) => entry.blob?.file)
    ).toEqual(['a', 'b']);
    expect(
      orderedUiBlobs(frames[1] ?? null, test).map((entry) => entry.blob?.file)
    ).toEqual(['d', 'c']);
  });
});

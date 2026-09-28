import { describe, expect, test } from 'bun:test';
import type { HtmlReportTest } from '@pkgs/harness';
import { fileLabel, fmtMs } from '../src/lib/format';
import { orderedUiBlobs, testFrames } from '../src/lib/frames';
import { buildHash, parseHash } from '../src/lib/hash';
import { renderHtmlReport } from '../src/render';
import type { ReportData } from '../src/types';

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
    // `bun run test:report` prefixes ids with the package (`libs/chess/…`).
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

describe('renderHtmlReport', () => {
  test('embeds title, custom element, and script tags', () => {
    const data: ReportData = {
      title: 'Hello Report',
      runId: 'run-1',
      status: 'passed',
      updatedAtMs: 0,
      tests: [],
    };
    const html = renderHtmlReport(data, { title: 'Hello Report' });
    expect(html).toContain('<harness-report></harness-report>');
    expect(html).toContain('id="report-data"');
    expect(html).toContain('Hello Report');
    expect(html).toContain('id="frame-css"');
  });
});

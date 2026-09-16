import { describe, expect, test } from 'bun:test';
import { fileLabel, fmtMs } from '../src/lib/format';
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
});

describe('format', () => {
  test('fmtMs and fileLabel', () => {
    expect(fmtMs(42)).toBe('42ms');
    expect(fmtMs(2500)).toBe('2.5s');
    expect(fileLabel('pkgs/sim/tests/foo.test.ts')).toBe('foo.test.ts');
    expect(fileLabel(undefined)).toBe('Other');
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
    expect(html).toContain('<sim-report></sim-report>');
    expect(html).toContain('id="report-data"');
    expect(html).toContain('Hello Report');
    expect(html).toContain('id="frame-css"');
  });
});

import { describe, expect, test } from 'bun:test';

import { readReportHosting, reportKey, reportUrl } from './report-key';

const A = 'a'.repeat(40);
const B = 'b'.repeat(40);

describe('reportKey', () => {
  test('two commits never share a key', () => {
    expect(reportKey(A, true)).not.toBe(reportKey(B, true));
  });

  test('the frames variant is part of the key', () => {
    expect(reportKey(A, true)).toBe(`${A}/frames/index.html`);
    expect(reportKey(A, false)).toBe(`${A}/no-frames/index.html`);
  });

  test('refuses anything but a full sha', () => {
    expect(() => reportKey('abc123', true)).toThrow('40-hex');
    expect(() => reportKey('main', true)).toThrow('40-hex');
  });
});

describe('reportUrl', () => {
  test('is the public hostname plus the key', () => {
    expect(reportUrl('reports.example.dev', A, true)).toBe(
      `https://reports.example.dev/${A}/frames/index.html`
    );
  });
});

describe('readReportHosting', () => {
  test('reads the bucket and hostname declared in global.tfvars.json', () => {
    const hosting = readReportHosting();
    expect(hosting.bucket.length).toBeGreaterThan(0);
    expect(hosting.hostname).toContain('.');
  });
});

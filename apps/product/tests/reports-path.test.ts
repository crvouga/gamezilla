import { describe, expect, test } from 'bun:test';

import { isReportsPath, reportsPathFor, reportsPathSha } from '@apps/product/reports-path';

const SHA = 'b'.repeat(40);

describe('reports routes', () => {
  test('a commit path round-trips, and the list has no commit', () => {
    expect(reportsPathSha(reportsPathFor(SHA))).toBe(SHA);
    expect(reportsPathSha(`${reportsPathFor(SHA)}/`)).toBe(SHA);
    expect(reportsPathSha(reportsPathFor(null))).toBeNull();
  });

  test('only a full sha names a commit', () => {
    expect(reportsPathSha('/reports/main')).toBeNull();
    expect(reportsPathSha(`/reports/${SHA.slice(0, 9)}`)).toBeNull();
    expect(reportsPathSha(`/other/${SHA}`)).toBeNull();
  });

  test('the reports screen owns /reports and nothing that merely starts like it', () => {
    expect(isReportsPath('/reports')).toBe(true);
    expect(isReportsPath(`/reports/${SHA}`)).toBe(true);
    expect(isReportsPath('/reportsx')).toBe(false);
    expect(isReportsPath('/')).toBe(false);
  });
});

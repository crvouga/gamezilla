/**
 * Basic fixtures for every edge-case catalog id.
 * Assert light contracts; deeper proofs live in transform-cases / sx-mapping.
 */

import { describe, expect, test } from 'bun:test';
import { checkCompleteness } from '../completeness-gate';
import { mapSxRecord } from '../sx-mapping';
import { transformFile } from '../transform';
import { COVERED_IDS } from './catalog-coverage';
import type { CatalogFixture } from './catalog-fixtures-data';
import { CATALOG_FIXTURES } from './catalog-fixtures-data';

const CLASS_HELPER_RE =
  /\b(?:cn|clsx|classnames|twMerge|twJoin|cx|cva|joinClass|sxStyle)\s*\(/;

type TransformFixture = CatalogFixture & { kind: 'transform' };

function expectNoCompletenessGate(): void {
  const hits = checkCompleteness([
    { path: 'libs/demo/x.tsx', nextText: '<div class="box p-1" />' },
  ]);
  expect(hits).toEqual([]);
  const leftover = checkCompleteness([
    {
      path: 'libs/demo/x.tsx',
      nextText:
        'import { Box } from "@pkgs/ui";\nexport const A = () => <Box sx={{ p: 1 }} />;',
    },
  ]);
  expect(leftover.length).toBeGreaterThan(0);
}

function expectMapDoesNotThrow(record: Record<string, unknown>): void {
  expect(record).toBeDefined();
  expect(() =>
    mapSxRecord(record as Record<string, string | number | boolean | null>)
  ).not.toThrow();
}

function expectHFixture(fixture: TransformFixture, text: string): void {
  if (fixture.id.startsWith('H.no-') || fixture.id === 'H.no-helper-import') {
    expect(text).not.toMatch(CLASS_HELPER_RE);
  }
  if (fixture.id === 'H.style-dash-case' && text.includes('style={{')) {
    expect(text).toMatch(/"[a-z]+(?:-[a-z]+)*":/);
  }
  if (fixture.id === 'H.class-before-classlist') {
    const classIdx = text.indexOf('class=');
    const listIdx = text.indexOf('classList=');
    if (classIdx >= 0 && listIdx >= 0) {
      expect(classIdx).toBeLessThan(listIdx);
    }
  }
}

function expectIFixture(fixture: TransformFixture, text: string): void {
  if (fixture.id === 'I.idempotence') {
    const again = transformFile(`catalog/${fixture.id}.tsx`, text);
    expect(again.text).toBe(text);
  }
  if (fixture.id === 'I.comments-preserved') {
    expect(text).toContain('/* keep */');
  }
  if (fixture.id === 'I.unrelated-imports') {
    expect(text).toContain('Button');
  }
  return undefined;
}

function expectTransformFixture(fixture: TransformFixture): void {
  expect(fixture.source).toBeDefined();
  const result = transformFile(`catalog/${fixture.id}.tsx`, fixture.source!);
  if (fixture.expectParseError) {
    expect(result.parseError).toBeDefined();
    return;
  }
  expect(result.parseError).toBe(undefined);
  expect(result.text).not.toContain('TODO(sx-codemod)');
  if (fixture.expectConverted) {
    expect(result.text).not.toMatch(CLASS_HELPER_RE);
    expect(result.manual).toEqual([]);
  }
  expectHFixture(fixture, result.text);
  expectIFixture(fixture, result.text);
}
describe('catalog basic fixtures', () => {
  test('COVERED_IDS matches fixture table', () => {
    expect(COVERED_IDS.size).toBe(CATALOG_FIXTURES.length);
  });

  for (const fixture of CATALOG_FIXTURES) {
    test(fixture.id, () => {
      if (fixture.kind === 'gate') {
        expectNoCompletenessGate();
        return;
      }
      if (fixture.kind === 'map') {
        expectMapDoesNotThrow(fixture.record!);
        return;
      }
      expectTransformFixture(fixture as TransformFixture);
    });
  }
});

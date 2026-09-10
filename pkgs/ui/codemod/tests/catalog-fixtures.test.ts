/**
 * Smoke fixtures for every edge-case catalog id.
 * Assert light contracts; deeper proofs live in transform-cases / sx-mapping.
 */

import { describe, expect, test } from 'vitest';
import { checkCompleteness } from '../completeness-gate';
import { mapSxRecord } from '../sx-mapping';
import { transformFile } from '../transform';
import { CATALOG_FIXTURES } from './catalog-fixtures-data';
import { COVERED_IDS } from './catalog-coverage';

const CLASS_HELPER_RE =
  /\b(?:cn|clsx|classnames|twMerge|twJoin|cx|cva|joinClass|sxStyle)\s*\(/;

describe('catalog smoke fixtures', () => {
  test('COVERED_IDS matches fixture table', () => {
    expect(COVERED_IDS.size).toBe(CATALOG_FIXTURES.length);
  });

  for (const fixture of CATALOG_FIXTURES) {
    test(fixture.id, () => {
      if (fixture.kind === 'gate') {
        const hits = checkCompleteness([
          {
            path: 'libs/demo/x.tsx',
            nextText: '<div class="box p-1" />',
          },
        ]);
        expect(hits).toEqual([]);
        const leftover = checkCompleteness([
          {
            path: 'libs/demo/x.tsx',
            nextText: 'import { Box } from "@pkgs/ui";\nexport const A = () => <Box sx={{ p: 1 }} />;',
          },
        ]);
        expect(leftover.length).toBeGreaterThan(0);
        return;
      }

      if (fixture.kind === 'map') {
        expect(fixture.record).toBeDefined();
        expect(() =>
          mapSxRecord(
            fixture.record as Record<string, string | number | boolean | null>
          )
        ).not.toThrow();
        return;
      }

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
      if (fixture.id.startsWith('H.no-') || fixture.id === 'H.no-helper-import') {
        expect(result.text).not.toMatch(CLASS_HELPER_RE);
      }
      if (fixture.id === 'H.style-dash-case' && result.text.includes('style={{')) {
        expect(result.text).toMatch(/"[a-z]+(?:-[a-z]+)*":/);
      }
      if (fixture.id === 'H.class-before-classlist') {
        const classIdx = result.text.indexOf('class=');
        const listIdx = result.text.indexOf('classList=');
        if (classIdx >= 0 && listIdx >= 0) {
          expect(classIdx).toBeLessThan(listIdx);
        }
      }
      if (fixture.id === 'I.idempotence') {
        const again = transformFile(`catalog/${fixture.id}.tsx`, result.text);
        expect(again.text).toBe(result.text);
      }
      if (fixture.id === 'I.comments-preserved') {
        expect(result.text).toContain('/* keep */');
      }
      if (fixture.id === 'I.unrelated-imports') {
        expect(result.text).toContain('Button');
      }
    });
  }
});

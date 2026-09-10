/**
 * Completeness gate unit checks.
 */

import { describe, expect, test } from 'vitest';
import { checkCompleteness } from '../completeness-gate';

describe('checkCompleteness', () => {
  test('clean converted output is empty', () => {
    expect(
      checkCompleteness([
        { path: 'libs/x.tsx', nextText: 'export const A = () => <div class="box p-1" />;' },
      ])
    ).toEqual([]);
  });

  test('flags sx attrs, purged tags, helpers, todos', () => {
    const hits = checkCompleteness([
      {
        path: 'libs/x.tsx',
        nextText: `import { Box } from '@pkgs/ui';
export const A = () => <Box sx={{ p: 1 }} class={cn('a')} />;
// TODO(sx-codemod)
`,
      },
    ]);
    const kinds = new Set(hits.map((h) => h.kind));
    expect(kinds.has('sx-attr')).toBe(true);
    expect(kinds.has('purged-tag')).toBe(true);
    expect(kinds.has('purged-import')).toBe(true);
    expect(kinds.has('class-helper')).toBe(true);
    expect(kinds.has('todo')).toBe(true);
  });

  test('allows SxProps in theme paths', () => {
    expect(
      checkCompleteness([
        {
          path: 'pkgs/ui/src/theme/sx-props.ts',
          nextText: 'export type SxProps = {}; export type SxInput = SxProps;',
        },
      ])
    ).toEqual([]);
  });

  test('flags SxProps outside theme', () => {
    const hits = checkCompleteness([
      {
        path: 'libs/chess/x.ts',
        nextText: 'import type { SxProps } from "@pkgs/ui"; export const x: SxProps = {};',
      },
    ]);
    expect(hits.some((h) => h.kind === 'sx-type')).toBe(true);
  });
});

/**
 * Completeness gate unit checks.
 */

import { describe, expect, test } from 'vitest';
import { checkCompleteness, stripComments } from '../completeness-gate';

describe('stripComments', () => {
  test('blanks line + block comments but keeps offsets and newlines', () => {
    const src = `const a = 1; // <Text sx={{ p: 1 }} />
/* <Box sx={{ p: 2 }} /> */
const b = 2;
`;
    const out = stripComments(src);
    expect(out).not.toContain('<Text');
    expect(out).not.toContain('<Box');
    expect(out).toContain('const a = 1;');
    expect(out).toContain('const b = 2;');
    expect(out.split('\n').length).toBe(src.split('\n').length);
    expect(out.length).toBe(src.length);
  });

  test('does not treat // inside a string literal as a comment', () => {
    const out = stripComments(`const url = "https://x.test/a";\n`);
    expect(out).toContain('https://x.test/a');
  });
});

describe('checkCompleteness', () => {
  test('clean converted output is empty', () => {
    expect(
      checkCompleteness([
        {
          path: 'libs/x.tsx',
          nextText: 'export const A = () => <div class="box p-1" />;',
        },
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
        nextText:
          'import type { SxProps } from "@pkgs/ui"; export const x: SxProps = {};',
      },
    ]);
    expect(hits.some((h) => h.kind === 'sx-type')).toBe(true);
  });
});

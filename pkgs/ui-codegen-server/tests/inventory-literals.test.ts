import { expect, test } from 'bun:test';
import { scanLiterals } from '@pkgs/ui-codegen-server/inventory-literals';

const literals = (text: string, language: 'css' | 'ts') =>
  scanLiterals('x', text, language).map((l) => [l.kind, l.literal, l.line]);

test('a CSS value is a literal; a token read and a comment are not', () => {
  const css = [
    '/* fades in over 150ms, 8px off */',
    '.a { border: 1px solid var(--ui-color-border); }',
    '.b { line-height: var(--ui-leading-sm); letter-spacing: -0.02em; }',
    '.c { animation: spin 1000ms steps(12, end) infinite; z-index: 1; }',
    '.d { --default-font-family: var(--ui-font-sans); --ease-out: var(--ui-easing-standard); }',
  ].join('\n');
  expect(literals(css, 'css')).toEqual([
    ['length', '1px', 2],
    ['font', 'letter-spacing: -0.02em', 3],
    ['duration', '1000ms', 4],
    ['easing', 'steps(12, end)', 4],
    ['z-index', 'z-index: 1', 4],
  ]);
});

test('TypeScript colors, steps off the token utilities and numeric constants', () => {
  const ts = [
    "// '#000000' in a comment",
    "const fill = { light: '#FFFFFF' };",
    "const cls = 'w-12 h-7 gap-ui-sm md:min-h-11 bg-tint-active';",
    'export const ICON_SIZE = 22;',
    "const url = 'https://example.com/#top';",
  ].join('\n');
  expect(literals(ts, 'ts')).toEqual([
    ['color', '#FFFFFF', 2],
    ['grid-utility', 'w-12', 3],
    ['grid-utility', 'h-7', 3],
    ['grid-utility', 'min-h-11', 3],
    ['numeric-constant', 'ICON_SIZE = 22', 4],
  ]);
});

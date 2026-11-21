import { describe, expect, test } from 'bun:test';
import { designProfile, designVocabularyViolations } from './design-vocabulary';

function hits(text: string, path = 'src/screen.tsx'): readonly string[] {
  return designVocabularyViolations([{ path, text }]);
}

describe('designVocabularyViolations', () => {
  // regression: game-ui-status-type-role
  test('game status uses the shared caption role', () => {
    expect(
      hits("const status = 'text-sm text-text-secondary';", 'src/s.ts').some(
        (violation) => violation.includes('ad-hoc type "text-sm"')
      )
    ).toBe(true);
    expect(
      hits("const status = 'text textCaption text-text-secondary';", 'src/s.ts')
    ).toEqual([]);
  });

  test('a violation names the role to use instead', () => {
    const out = hits("const tone = 'text-xs';", 'src/tone.ts');
    expect(out).toEqual([
      'src/tone.ts:1: ad-hoc type "text-xs" — use a type role (`P` / `Text` `variant`, `H1`–`H6` `size`, or `text textTitle | textHeading | textSubtitle | textBody | textBodyBold | textLabel | textCaption | textFootnote` inside the design system)',
    ]);
  });

  test('variants do not hide a banned utility', () => {
    expect(hits("const c = 'md:text-xs';", 'src/c.ts')).toHaveLength(1);
    expect(hits("const c = 'md:gap-1.5';", 'src/c.ts')).toHaveLength(1);
    expect(hits("const c = 'dark:bg-surface';", 'src/c.ts')).toHaveLength(1);
  });

  test('steps off the 4px grid are rejected, whole steps are not', () => {
    for (const token of [
      'gap-1.5',
      'px-2.5',
      'w-0.25',
      '-mt-0.75',
      'inset-x-0.5',
    ]) {
      expect(hits(`const c = '${token}';`, 'src/c.ts')).toHaveLength(1);
    }
    for (const token of ['gap-2', 'px-3', 'w-full', 'h-px', 'opacity-50']) {
      expect(hits(`const c = '${token}';`, 'src/c.ts')).toEqual([]);
    }
  });

  test('raw colors are rejected in stylesheets, but not in comments', () => {
    const css =
      '/* #fff is white */\n.a { color: #fff; background: rgba(0, 0, 0, 0.5); }';
    expect(hits(css, 'src/a.module.css')).toEqual([
      'src/a.module.css:2: raw color "#fff" — use a color token (`var(--ui-color-*)`)',
      'src/a.module.css:2: raw color "rgba(" — use a color token (`var(--ui-color-*)`)',
    ]);
    expect(hits('.a { color: var(--ui-color-text); }', 'src/a.css')).toEqual(
      []
    );
  });

  test('generated tokens and brand marks may name colors', () => {
    expect(
      designVocabularyViolations(
        [
          { path: 'src/tokens.css', text: ':root { --a: #fff; }' },
          { path: 'src/brand-logos/index.tsx', text: "const g = '#4285F4';" },
        ],
        'design-system'
      )
    ).toEqual([]);
  });

  test('the design system may write type utilities; components may not', () => {
    const file = { path: 'src/strong.tsx', text: "const c = 'font-semibold';" };
    expect(designVocabularyViolations([file], 'design-system')).toEqual([]);
    expect(designVocabularyViolations([file], 'component')).toHaveLength(1);
  });

  test('token var references and text-color tokens are allowed', () => {
    expect(
      hits(
        "const paint = { 'border-color': 'var(--ui-color-tint)', tone: 'text-tint text-destructive' };",
        'src/paint.ts'
      )
    ).toEqual([]);
  });
});

describe('product composition', () => {
  test('raw elements and restyling attributes are reported', () => {
    const out = hits(
      [
        'export const A = () => (',
        '  <div class="box">',
        '    <P variant="caption" style={{ color: "red" }}>Hi</P>',
        '  </div>',
        ');',
      ].join('\n')
    );
    expect(out.map((line) => line.split(' — ')[0])).toEqual([
      'src/screen.tsx:2: raw element <div>',
      'src/screen.tsx:2: restyling attribute "class"',
      'src/screen.tsx:3: restyling attribute "style"',
    ]);
  });

  test('components, generics and fragments are composition', () => {
    expect(
      hits(
        [
          "const [v] = createSignal<string>('');",
          'export const A = () => (',
          '  <>',
          '    <StackVertical gap="sm"><P>{v()}</P></StackVertical>',
          '  </>',
          ');',
        ].join('\n')
      )
    ).toEqual([]);
  });

  test('component packages may draw their own primitives', () => {
    const file = { path: 'src/board.tsx', text: 'const B = () => <svg />;' };
    expect(designVocabularyViolations([file], 'component')).toEqual([]);
    expect(designVocabularyViolations([file], 'product')).toHaveLength(1);
  });
});

describe('pixel literals and font names', () => {
  const PROFILES = ['design-system', 'component', 'product'] as const;

  test('every UI profile rejects a pixel literal in CSS, TS and TSX', () => {
    for (const profile of PROFILES) {
      for (const file of [
        { path: 'src/a.module.css', text: '.a { padding: 12px; }' },
        { path: 'src/a.ts', text: "const edge = '12px';" },
        { path: 'src/a.tsx', text: "const edge = <Box gap={'12px'} />;" },
      ]) {
        expect(
          designVocabularyViolations([file], profile).some((violation) =>
            violation.includes('pixel literal "12px"')
          )
        ).toBe(true);
      }
    }
  });

  test('negative, fractional and zero pixels are literals too', () => {
    const css = '.a { margin: -2px; outline-width: 0.5px; inset: 0px; }';
    expect(hits(css, 'src/a.css')).toEqual([
      'src/a.css:1: pixel literal "-2px" — use a length token (`var(--ui-space-*)`, `var(--ui-border-width-*)`, `var(--ui-size-*)`, or `0`)',
      'src/a.css:1: pixel literal "0.5px" — use a length token (`var(--ui-space-*)`, `var(--ui-border-width-*)`, `var(--ui-size-*)`, or `0`)',
      'src/a.css:1: pixel literal "0px" — use a length token (`var(--ui-space-*)`, `var(--ui-border-width-*)`, `var(--ui-size-*)`, or `0`)',
    ]);
  });

  test('comments may name a size; code may not', () => {
    const ts = [
      '// a 44px hit area',
      '/* the 2px focus ring */',
      '/** 16px of ranks */',
      "const gap = 'var(--ui-space-1)';",
      'const ring = <Box /* 3px */ />;',
    ].join('\n');
    expect(hits(ts, 'src/a.tsx')).toEqual([]);
    expect(hits('/* 1px */\n.a { border-width: 1px; }', 'src/a.css')).toEqual([
      'src/a.css:2: pixel literal "1px" — use a length token (`var(--ui-space-*)`, `var(--ui-border-width-*)`, `var(--ui-size-*)`, or `0`)',
    ]);
  });

  test('token references, unitless zero and computed lengths pass', () => {
    const css =
      '.a { border: var(--ui-border-width-hairline) solid; margin: calc(var(--ui-space-1) * -1); inset: 0; }';
    expect(hits(css, 'src/a.css')).toEqual([]);
    expect(
      hits('const w = `${cellSize * 4}px`; const h = cssPx(n);', 'src/a.ts')
    ).toEqual([]);
    expect(hits("const c = 'h-px w-px';", 'src/a.ts')).toEqual([]);
  });

  test('a query condition keeps its pixels; its block does not', () => {
    const css =
      '@media (max-width: 639px) {\n  .a { gap: 4px; }\n}\n@container game (min-width: 880px) {}';
    expect(hits(css, 'src/a.css')).toEqual([
      'src/a.css:2: pixel literal "4px" — use a length token (`var(--ui-space-*)`, `var(--ui-border-width-*)`, `var(--ui-size-*)`, or `0`)',
    ]);
  });

  test('only theme.css writes out Tailwind breakpoints', () => {
    const theme = '@theme {\n  --breakpoint-sm: 640px;\n}';
    expect(
      designVocabularyViolations(
        [{ path: 'src/theme.css', text: theme }],
        'design-system'
      )
    ).toEqual([]);
    expect(hits(theme, 'src/other.css')).toHaveLength(1);
  });

  test('font family names are rejected, font tokens are not', () => {
    for (const text of [
      '.a { font-family: Manrope, sans-serif; }',
      '.a { font-family: "Segoe UI"; }',
      '.a { font-family: Menlo, Consolas, monospace; }',
      '.a { font-family: system-ui, -apple-system, Roboto; }',
      '.a { font-family: Inter, Arial, Helvetica; }',
    ]) {
      expect(hits(text, 'src/a.css').length).toBeGreaterThan(0);
    }
    expect(hits("const f = 'Arial';", 'src/a.ts')).toEqual([
      'src/a.ts:1: font name "Arial" — use a font token (`var(--ui-font-sans | display | mono)` or a type role)',
    ]);
    expect(
      hits('.a { font-family: var(--ui-font-system); }', 'src/a.css')
    ).toEqual([]);
    expect(hits('// set in Manrope\nconst x = 1;', 'src/a.ts')).toEqual([]);
  });

  test('raw hex colors are still rejected beside the new rules', () => {
    expect(hits("const c = '#fff';", 'src/a.ts')).toHaveLength(1);
    expect(hits('.a { color: #fff; }', 'src/a.css')).toHaveLength(1);
  });

  test('generated token output may carry pixels and font names', () => {
    expect(
      designVocabularyViolations(
        [
          {
            path: 'src/tokens.css',
            text: ':root { --ui-space-1: 4px; --ui-font-sans: Manrope, system-ui; }',
          },
          { path: 'src/token-names.ts', text: "const a = '12px';" },
        ],
        'design-system'
      )
    ).toEqual([]);
  });

  test('tests are not read', () => {
    expect(hits('.a { gap: 4px; }', 'tests/a.css')).toEqual([]);
  });
});

describe('designProfile', () => {
  test('names the profile of each kind of UI package', () => {
    expect(designProfile('pkgs/ui-root-client-ts')).toBe('design-system');
    expect(designProfile('libs/spaces-client-ts')).toBe('product');
    expect(designProfile('apps/client-ts')).toBe('product');
    expect(designProfile('pkgs/feedback-client-ts')).toBe('product');
    expect(designProfile('pkgs/chess-board-root-client-ts')).toBe('component');
    expect(designProfile('libs/spaces-shared-ts')).toBeNull();
  });
});

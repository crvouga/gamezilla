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

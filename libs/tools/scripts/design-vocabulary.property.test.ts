import { describe, expect, test } from 'bun:test';
import { assertProperty } from '@pkgs/property-shared/assert-property';
import fc from 'fast-check';
import { designVocabularyViolations } from './design-vocabulary';

/** Words a product screen may write: layout, type roles, color tokens. */
const ALLOWED = [
  'box',
  'text',
  'flex-row',
  'flex-1',
  'items-center',
  'justify-between',
  'gap-2',
  'gap-3',
  'p-4',
  'px-4',
  'min-w-0',
  'line-clamp-1',
  'tabular-nums',
  'capitalize',
  'textTitle',
  'textHeading',
  'textSubtitle',
  'textLabel',
  'textBody',
  'textCaption',
  'textFootnote',
  'textNumeral',
  'text-text',
  'text-text-secondary',
  'text-tint',
  'bg-surface',
  'bg-surface-muted',
  'bg-tint-active',
  'rounded-card',
  'border-border',
] as const;

/** Words the design system owns, one per rule. */
const BANNED = [
  'text-xs',
  'text-2xl',
  'text-micro',
  'font-bold',
  'font-semibold',
  'font-mono',
  'leading-relaxed',
  'tracking-wide',
  'uppercase',
  'italic',
  'shadow',
  'shadow-lg',
  'drop-shadow-md',
  'w-[37px]',
  'pt-[8px]',
  '#ff0000',
  '#fff',
  'rgba(0,0,0,0.5)',
  'hsla(0,0%,0%,1)',
] as const;

const allowedClasses = fc.array(fc.constantFrom(...ALLOWED), {
  minLength: 0,
  maxLength: 8,
});

/** A screen of `lines` class strings, optionally with filler code between. */
const screen = fc.array(
  fc.record({
    classes: allowedClasses,
    filler: fc.constantFrom('', 'const x = 1;', '<div>'),
  }),
  { minLength: 1, maxLength: 6 }
);

function render(lines: readonly { classes: string[]; filler: string }[]) {
  return lines.map(
    (line) => `${line.filler}<p class="${line.classes.join(' ')}" />`
  );
}

describe('designVocabularyViolations', () => {
  test('the allowed vocabulary is never reported', () => {
    assertProperty(
      'allowed vocabulary passes',
      fc.property(screen, (lines) => {
        const text = render(lines).join('\n');
        expect(
          designVocabularyViolations([{ path: 'src/a.tsx', text }])
        ).toEqual([]);
      })
    );
  });

  test('one off-vocabulary word anywhere is reported once, at its line', () => {
    assertProperty(
      'banned word found',
      fc.property(
        screen,
        fc.constantFrom(...BANNED),
        fc.nat(),
        fc.nat(),
        (lines, banned, lineSeed, slotSeed) => {
          const index = lineSeed % lines.length;
          const target = lines[index]!;
          const classes = [...target.classes];
          classes.splice(slotSeed % (classes.length + 1), 0, banned);
          const rendered = render(lines);
          rendered[index] = render([{ ...target, classes }])[0]!;
          const out = designVocabularyViolations([
            { path: 'src/a.tsx', text: rendered.join('\n') },
          ]);
          expect(out).toHaveLength(1);
          expect(out[0]).toContain(`src/a.tsx:${index + 1}:`);
          expect(out[0]).toContain(`"${banned}"`);
        }
      )
    );
  });

  test('comments, tests and non-UI files are never read', () => {
    assertProperty(
      'unread sources pass',
      fc.property(
        fc.constantFrom(...BANNED),
        fc.constantFrom(
          { path: 'src/a.tsx', wrap: (w: string) => `// "${w}"` },
          { path: 'src/a.tsx', wrap: (w: string) => ` * "${w}"` },
          { path: 'tests/a.tsx', wrap: (w: string) => `<p class="${w}" />` },
          { path: 'src/a.ts', wrap: (w: string) => `const c = '${w}';` }
        ),
        (banned, source) => {
          expect(
            designVocabularyViolations([
              { path: source.path, text: source.wrap(banned) },
            ])
          ).toEqual([]);
        }
      )
    );
  });
});

/**
 * Style-equivalence property: the heart of the proof.
 *
 * For arbitrary valid `SxProps` records, the declarations implied by the
 * codemod's Tailwind classes must equal the declarations the runtime `sx`
 * compiler (`sxToCss`) emits — over every property the sx touches. A
 * mismatch means a visual regression, so the property fails loudly.
 *
 * Declaration-level equivalence is the provable proxy for computed-style
 * equivalence: no browser engine is wired in this repo (happy-dom cannot
 * compute styles), and every declaration here flows from the same scale
 * tables the runtime uses. Each side is normalized for shorthand spellings
 * (`flex:1` ≡ `flex:1 1 0%`, `font-weight:bold` ≡ `700`) before comparing.
 */

import { describe, expect, test } from 'bun:test';
import * as fc from 'fast-check';
import { CSS_VAR_COLORS, cssVarElevation } from '../../src/theme/css-vars';
import { sxToCss } from '../legacy-sx-to-css';
import { compileStaticTransform } from '../sx-map-effect';
import { mapSxRecord } from '../sx-mapping';
import { resolveClass } from './class-declaration';

const SCALE_STEPS = [0, 0.5, 1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
const COLORS = [
  'surface',
  'text',
  'textSecondary',
  'tint',
  'destructive',
  'danger',
  'primary',
  'border',
  'transparent',
  '#fff',
  'mystery-token',
];

function parseDeclarations(css: string): string[] {
  if (css === '') return [];
  return css.split(';').map((d) => normalize(d));
}

/** Canonicalize shorthand spellings both sides may use. */
function normalize(decl: string): string {
  const flex = /^flex:(-?\d+(?:\.\d+)?)$/.exec(decl);
  if (flex !== null) return `flex:${flex[1]} 1 0%`;
  if (decl === 'font-weight:bold') return 'font-weight:700';
  if (decl === 'font-weight:normal') return 'font-weight:400';
  return decl.replace(
    /:(transparent|inherit|currentcolor)$/i,
    (_, k: string) => `:${k.toLowerCase()}`
  );
}

const arbRecord: fc.Arbitrary<Record<string, string | number | boolean>> = fc
  .array(
    fc.oneof(
      fc.record({
        prop: fc.constantFrom(
          'p',
          'px',
          'py',
          'pt',
          'pb',
          'm',
          'mx',
          'mt',
          'gap',
          'rowGap'
        ),
        value: fc.constantFrom(...SCALE_STEPS),
      }),
      fc.record({
        prop: fc.constantFrom(
          'background',
          'backgroundColor',
          'color',
          'borderColor',
          'borderTopColor'
        ),
        value: fc.constantFrom(...COLORS),
      }),
      fc.record({
        prop: fc.constant('fontSize'),
        value: fc.oneof(
          fc.constantFrom('xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl'),
          fc.integer({ min: 8, max: 48 })
        ),
      }),
      fc.record({
        prop: fc.constant('lineHeight'),
        value: fc.oneof(
          fc.constantFrom('tight', 'normal', 'relaxed'),
          fc.integer({ min: 12, max: 60 })
        ),
      }),
      fc.record({
        prop: fc.constant('fontWeight'),
        value: fc.constantFrom('normal', 'bold', 100, 400, 600, 900, '500'),
      }),
      fc.record({
        prop: fc.constant('fontStyle'),
        value: fc.constantFrom('normal', 'italic'),
      }),
      fc.record({
        prop: fc.constant('textAlign'),
        value: fc.constantFrom('left', 'right', 'center', 'justify'),
      }),
      fc.record({
        prop: fc.constant('textTransform'),
        value: fc.constantFrom('none', 'uppercase', 'lowercase', 'capitalize'),
      }),
      fc.record({
        prop: fc.constant('userSelect'),
        value: fc.constantFrom('auto', 'none', 'text', 'all', 'contain'),
      }),
      fc.record({
        prop: fc.constant('whiteSpace'),
        value: fc.constantFrom(
          'normal',
          'nowrap',
          'pre',
          'pre-wrap',
          'pre-line'
        ),
      }),
      fc.record({
        prop: fc.constant('textOverflow'),
        value: fc.constantFrom('clip', 'ellipsis'),
      }),
      fc.record({
        prop: fc.constant('textDecorationLine'),
        value: fc.constantFrom(
          'none',
          'underline',
          'line-through',
          'underline line-through'
        ),
      }),
      fc.record({
        prop: fc.constant('display'),
        value: fc.constantFrom(
          'flex',
          'none',
          'block',
          'inline',
          'inline-flex',
          'grid',
          'contents'
        ),
      }),
      fc.record({
        prop: fc.constant('flexDirection'),
        value: fc.constantFrom(
          'row',
          'column',
          'row-reverse',
          'column-reverse'
        ),
      }),
      fc.record({
        prop: fc.constant('flexWrap'),
        value: fc.constantFrom('wrap', 'nowrap', 'wrap-reverse'),
      }),
      fc.record({
        prop: fc.constant('alignItems'),
        value: fc.constantFrom(
          'flex-start',
          'flex-end',
          'center',
          'stretch',
          'baseline'
        ),
      }),
      fc.record({
        prop: fc.constant('alignSelf'),
        value: fc.constantFrom(
          'auto',
          'flex-start',
          'flex-end',
          'center',
          'stretch',
          'baseline'
        ),
      }),
      fc.record({
        prop: fc.constant('justifyContent'),
        value: fc.constantFrom(
          'flex-start',
          'flex-end',
          'center',
          'space-between',
          'space-around',
          'space-evenly'
        ),
      }),
      fc.record({
        prop: fc.constant('overflow'),
        value: fc.constantFrom('visible', 'hidden', 'scroll'),
      }),
      fc.record({
        prop: fc.constant('position'),
        value: fc.constantFrom('absolute', 'relative', 'static', 'fixed'),
      }),
      fc.record({
        prop: fc.constant('visibility'),
        value: fc.constantFrom('visible', 'hidden'),
      }),
      fc.record({
        prop: fc.constantFrom(
          'width',
          'height',
          'top',
          'flexBasis',
          'paddingTop',
          'marginLeft'
        ),
        value: fc.oneof(
          fc.integer({ min: 0, max: 200 }),
          fc.constantFrom('50%', 'auto', '100%')
        ),
      }),
      fc.record({
        prop: fc.constant('flex'),
        value: fc.constantFrom(0, 1, 2, -1),
      }),
      fc.record({
        prop: fc.constantFrom('flexGrow', 'flexShrink'),
        value: fc.constantFrom(0, 1, 2),
      }),
      fc.record({
        prop: fc.constantFrom(
          'borderWidth',
          'borderTopWidth',
          'borderBottomWidth'
        ),
        value: fc.oneof(
          fc.integer({ min: 0, max: 4 }),
          fc.constant('hairline')
        ),
      }),
      fc.record({
        prop: fc.constant('borderStyle'),
        value: fc.constantFrom('solid', 'dotted', 'dashed'),
      }),
      fc.record({
        prop: fc.constant('opacity'),
        value: fc.oneof(
          fc.constantFrom(0, 0.5, 1, 0.37),
          fc.integer({ min: 0, max: 1 })
        ),
      }),
      fc.record({
        prop: fc.constantFrom('borderRadius', 'borderTopLeftRadius'),
        value: fc.oneof(
          fc.constantFrom('none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'full'),
          fc.integer({ min: 0, max: 40 })
        ),
      }),
      fc.record({
        prop: fc.constant('elevation'),
        value: fc.integer({ min: 0, max: 5 }),
      }),
      fc.record({
        prop: fc.constant('pointerEvents'),
        value: fc.constantFrom('auto', 'none', 'box-none', 'box-only'),
      }),
      fc.record({
        prop: fc.constant('lineClamp'),
        value: fc.integer({ min: 1, max: 6 }),
      }),
      fc.record({ prop: fc.constant('absoluteFill'), value: fc.boolean() }),
      fc.record({
        prop: fc.constant('cursor'),
        value: fc.constantFrom('pointer', 'default', 'text', 'not-allowed'),
      }),
      fc.record({
        prop: fc.constant('zIndex'),
        value: fc.integer({ min: -5, max: 50 }),
      }),
      fc.record({
        prop: fc.constant('aspectRatio'),
        value: fc.oneof(
          fc.constantFrom('16 / 9', '1 / 1'),
          fc.float({ min: 0.5, max: 3, noNaN: true })
        ),
      }),
      fc.record({
        prop: fc.constant('inset'),
        value: fc.integer({ min: 0, max: 24 }),
      }),
      fc.record({
        prop: fc.constant('outlineWidth'),
        value: fc.integer({ min: 0, max: 8 }),
      }),
      fc.record({
        prop: fc.constant('letterSpacing'),
        value: fc.integer({ min: 0, max: 12 }),
      }),
      fc.record({
        prop: fc.constantFrom(
          'gridTemplateColumns',
          'gridColumn',
          'boxShadow',
          'animationDuration'
        ),
        value: fc.constantFrom('1fr 2fr', 'span 2', '0 1px 2px black', '200ms'),
      }),
      fc.record({
        prop: fc.constant('fontFamily'),
        value: fc.constantFrom(
          'system-ui',
          'SF Pro Rounded, sans-serif',
          'Menlo, monospace'
        ),
      })
    ),
    { minLength: 1, maxLength: 6 }
  )
  .map((pairs) => {
    const out: Record<string, string | number | boolean> = {};
    for (const pair of pairs) out[pair.prop] = pair.value;
    return out;
  });

describe('style equivalence vs the sx runtime', () => {
  test('arbitrary sx records compile to identical declarations', async () => {
    await fc.assert(
      fc.property(arbRecord, (record) => {
        const oracle = parseDeclarations(
          sxToCss(record, {
            colors: CSS_VAR_COLORS,
            elevation: cssVarElevation,
          })
        ).sort();
        const mapped = mapSxRecord(record);
        expect(mapped.bailed).toEqual([]);
        const actual = mapped.classes
          .flatMap((c) => resolveClass(c))
          .map(normalize)
          .sort();
        expect(actual).toEqual(oracle);
      }),
      { numRuns: 300 }
    );
  });

  test('static transform pieces compile with runtime px rules', () => {
    expect(
      compileStaticTransform([
        { key: 'translateX', value: 4 },
        { key: 'scale', value: 2 },
      ])
    ).toBe('[transform:translateX(4px)_scale(2)]');
    expect(compileStaticTransform([{ key: 'rotate', value: '45deg' }])).toBe(
      '[transform:rotate(45deg)]'
    );
    expect(compileStaticTransform([])).toBe(undefined);
  });
});

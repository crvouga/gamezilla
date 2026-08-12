import { describe, expect, test } from 'bun:test';
import { PALETTE } from './colors/color-palette';
import { makeElevation } from './scale';
import { createSx, flattenSx } from './sx';
import { sxToCss } from './sx-to-css';

const colors = PALETTE.light;
const elevation = makeElevation(colors, 'light');
const sx = createSx(colors, { elevation });

function css(input: Parameters<typeof sxToCss>[0]): string {
  return sxToCss(input, { colors, elevation });
}

describe('flattenSx', () => {
  test('later entries win', () => {
    expect(flattenSx([{ p: 1 }, { p: 2 }, false, null])).toEqual({ p: 2 });
  });

  test('empty / falsey becomes undefined', () => {
    expect(flattenSx(undefined)).toBeUndefined();
    expect(flattenSx([null, false])).toBeUndefined();
  });
});

describe('createSx', () => {
  test('scales spacing shorthands on the 4px grid', () => {
    expect(sx({ p: 2, mx: 4, gap: 1 })).toEqual({
      padding: 8,
      marginHorizontal: 16,
      gap: 4,
    });
  });

  test('resolves color tokens and leaves raw colors', () => {
    const out = sx({
      background: 'surface',
      color: '#f00',
      borderColor: 'border',
    });
    expect(out['backgroundColor']).toBe(colors.surface);
    expect(out['color']).toBe('#f00');
    expect(out['borderColor']).toBe(colors.border);
  });

  test('resolves radius and fontSize tokens', () => {
    const out = sx({ borderRadius: 'md', fontSize: 'sm', lineHeight: 18 });
    expect(out['borderRadius']).toBe(10);
    expect(out['fontSize']).toBe(14);
    expect(out['lineHeight']).toBe(18);
  });

  test('absoluteFill and inset', () => {
    expect(sx({ absoluteFill: true })).toEqual({
      position: 'absolute',
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    });
    expect(sx({ inset: 8 })).toEqual({
      top: 8,
      right: 8,
      bottom: 8,
      left: 8,
    });
  });

  test('hairline border and elevation boxShadow', () => {
    const out = sx({ borderBottomWidth: 'hairline', elevation: 2 });
    expect(typeof out['borderBottomWidth']).toBe('number');
    expect(out['borderBottomWidth']).toBeGreaterThan(0);
    expect(typeof out['boxShadow']).toBe('string');
  });
});

describe('sxToCss', () => {
  test('emits px for lengths including lineHeight', () => {
    const out = css({ p: 2, fontSize: 'xs', lineHeight: 18 });
    expect(out).toContain('padding:8px');
    expect(out).toContain('font-size:12px');
    expect(out).toContain('line-height:18px');
    expect(out).not.toContain('line-height:18;');
  });

  test('resolves tokens and expands horizontal shorthands', () => {
    const out = css({
      background: 'surface',
      px: 3,
      borderRadius: 'lg',
    });
    expect(out).toContain(`background-color:${colors.surface}`);
    expect(out).toContain('padding-left:12px');
    expect(out).toContain('padding-right:12px');
    expect(out).toContain('border-radius:14px');
  });

  test('compiles transform arrays and hairline', () => {
    const out = css({
      transform: [{ translateY: 8 }, { scale: 0.98 }],
      borderBottomWidth: 'hairline',
    });
    expect(out).toContain('transform:translateY(8px) scale(0.98)');
    expect(out).toContain('border-bottom-width:1px');
  });

  test('maps box-none pointerEvents and elevation shadow', () => {
    const out = css({ pointerEvents: 'box-none', elevation: 1 });
    expect(out).toContain('pointer-events:none');
    expect(out).toContain('box-shadow:');
    expect(out).not.toContain('elevation:');
  });

  test('rewrites Expo font families', () => {
    const out = css({ fontFamily: 'Nunito_600SemiBold' });
    expect(out).toContain('font-family:Nunito');
    expect(out).toContain('font-weight:600');
  });

  test('passes through web CSS transitions', () => {
    const out = sx({
      transitionProperty: 'opacity',
      transitionDuration: '1.2s',
    });
    expect(out['transitionProperty']).toBe('opacity');
    expect(out['transitionDuration']).toBe('1.2s');
    expect(
      css({ transitionProperty: 'opacity', transitionDuration: '1.2s' })
    ).toContain('transition-property:opacity');
  });

  test('snapshots animated nodes via bound __getValue', () => {
    const node = {
      _value: 0.4,
      __getValue() {
        return this._value;
      },
    };
    expect(css({ opacity: node })).toContain('opacity:0.4');
    expect(sx({ opacity: node })['opacity']).toBe(node);
  });
});

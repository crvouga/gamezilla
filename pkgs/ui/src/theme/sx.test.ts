import { describe, expect, test } from 'bun:test';
import { PALETTE } from './colors/color-palette';
import { makeElevation } from './scale';
import { createSx, flattenSx } from './sx';

const colors = PALETTE.light;
const elevation = makeElevation(colors, 'light');
const sx = createSx(colors, { elevation });

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

  test('passes through web CSS transitions', () => {
    const out = sx({
      transitionProperty: 'opacity',
      transitionDuration: '1.2s',
    });
    expect(out['transitionProperty']).toBe('opacity');
    expect(out['transitionDuration']).toBe('1.2s');
  });

  test('snapshots animated nodes via bound __getValue', () => {
    const node = {
      _value: 0.4,
      __getValue() {
        return this._value;
      },
    };
    expect(sx({ opacity: node })['opacity']).toBe(node);
  });
});

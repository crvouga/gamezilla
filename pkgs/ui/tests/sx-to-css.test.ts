import { COLOR_PALETTE } from '@pkgs/ui/theme/colors/color-palette';
import { makeElevation } from '@pkgs/ui/theme/scale';
import { sxToCss } from '@pkgs/ui/theme/sx-to-css';
import { describe, expect, test } from 'vitest';

const colors = COLOR_PALETTE.light;
const elevation = makeElevation(colors, 'light');

function css(input: Parameters<typeof sxToCss>[0]): string {
  return sxToCss(input, { colors, elevation });
}

describe('sxToCss', () => {
  test('empty / falsey input is an empty string', () => {
    expect(css(undefined)).toBe('');
    expect(css(null)).toBe('');
    expect(css(false)).toBe('');
    expect(css([null, false])).toBe('');
  });

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

  test('maps box-none pointerEvents; elevation emits no boxShadow', () => {
    const out = css({ pointerEvents: 'box-none', elevation: 1 });
    expect(out).toContain('pointer-events:none');
    expect(out).not.toContain('box-shadow:');
    expect(out).not.toContain('elevation:');
  });

  test('passes through web CSS transitions', () => {
    expect(
      css({ transitionProperty: 'opacity', transitionDuration: '1.2s' })
    ).toContain('transition-property:opacity');
  });

  test('zero lengths omit the px unit', () => {
    const out = css({ p: 0, width: 0, inset: 0 });
    expect(out).toContain('padding:0');
    expect(out).toContain('width:0');
    expect(out).toContain('top:0');
    expect(out).not.toContain('padding:0px');
    expect(out).not.toContain('width:0px');
  });

  test('unitless numbers do not get px', () => {
    const out = css({
      flex: 1,
      flexGrow: 2,
      flexShrink: 0,
      zIndex: 3,
      fontWeight: 600,
      aspectRatio: 1.5,
      animationIterationCount: 2,
    });
    expect(out).toContain('flex:1');
    expect(out).toContain('flex-grow:2');
    expect(out).toContain('flex-shrink:0');
    expect(out).toContain('z-index:3');
    expect(out).toContain('font-weight:600');
    expect(out).toContain('aspect-ratio:1.5');
    expect(out).toContain('animation-iteration-count:2');
    expect(out).not.toContain('flex-grow:2px');
    expect(out).not.toContain('z-index:3px');
    expect(out).not.toContain('font-weight:600px');
  });

  test('maps flex:0 and flex:-1 to 0 1 auto (not CSS flex:0)', () => {
    expect(css({ flex: 0 })).toContain('flex:0 1 auto');
    expect(css({ flex: -1 })).toContain('flex:0 1 auto');
    expect(css({ flex: 0 })).not.toMatch(/flex:0(?:;|$)/);
  });

  test('absoluteFill and inset', () => {
    expect(css({ absoluteFill: true })).toBe(
      'position:absolute;top:0;right:0;bottom:0;left:0'
    );
    const inset = css({ inset: 8 });
    expect(inset).toContain('top:8px');
    expect(inset).toContain('right:8px');
    expect(inset).toContain('bottom:8px');
    expect(inset).toContain('left:8px');
  });

  test('raw padding/margin pairs are not scaled', () => {
    const out = css({
      paddingHorizontal: 12,
      paddingVertical: 8,
      marginHorizontal: 4,
    });
    expect(out).toContain('padding-left:12px');
    expect(out).toContain('padding-right:12px');
    expect(out).toContain('padding-top:8px');
    expect(out).toContain('padding-bottom:8px');
    expect(out).toContain('margin-left:4px');
    expect(out).toContain('margin-right:4px');
  });

  test('background wins over backgroundColor', () => {
    const out = css({
      background: 'surface',
      backgroundColor: '#f00',
    });
    expect(out).toContain(`background-color:${colors.surface}`);
    expect(out).not.toContain('background-color:#f00');
  });

  test('quotes font families that are not CSS idents', () => {
    expect(css({ fontFamily: 'Comic Sans' })).toContain(
      'font-family:"Comic Sans"'
    );
  });

  test('does not quote a CSS font stack as a single family name', () => {
    expect(css({ fontFamily: 'Nunito, system-ui, sans-serif' })).toContain(
      'font-family:Nunito,system-ui,sans-serif'
    );
  });

  test('skips box-only pointerEvents; emits animationName', () => {
    const out = css({ pointerEvents: 'box-only', animationName: 'spin' });
    expect(out).not.toContain('pointer-events');
    expect(out).toContain('animation-name:spin');
  });

  test('flattens arrays with later entries winning', () => {
    const out = css([{ p: 1 }, { p: 2 }, false]);
    expect(out).toContain('padding:8px');
    expect(out).not.toContain('padding:4px');
  });

  test('elevation does not override an explicit background', () => {
    const out = sxToCss(
      { elevation: 2, background: 'surface' },
      {
        colors,
        elevation: () => ({
          boxShadow: '0 1px 2px #000',
          backgroundColor: '#111',
        }),
      }
    );
    expect(out).toContain('box-shadow:0 1px 2px #000');
    expect(out).toContain(`background-color:${colors.surface}`);
    expect(out).not.toContain('background-color:#111');
  });

  test('elevation supplies background when none is set', () => {
    const out = sxToCss(
      { elevation: 2 },
      {
        colors,
        elevation: () => ({
          boxShadow: '0 1px 2px #000',
          backgroundColor: '#111',
        }),
      }
    );
    expect(out).toContain('background-color:#111');
  });

  test('explicit boxShadow wins over elevation', () => {
    const out = sxToCss(
      { elevation: 1, boxShadow: 'none' },
      {
        colors,
        elevation: () => ({ boxShadow: '0 1px 2px #000' }),
      }
    );
    expect(out).toContain('box-shadow:none');
    expect(out).not.toContain('0 1px 2px');
  });
});

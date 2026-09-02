import { describe, expect, test } from 'bun:test';
import { expoFontFaceForWeight, parseExpoFontFamily } from './expo-font-family';

describe('parseExpoFontFamily', () => {
  test('splits Expo postscript names', () => {
    expect(parseExpoFontFamily('Nunito_400Regular')).toEqual({
      family: 'Nunito',
      weight: '400',
    });
    expect(parseExpoFontFamily('Nunito_800ExtraBold')).toEqual({
      family: 'Nunito',
      weight: '800',
    });
  });

  test('ignores CSS stacks and platform names', () => {
    expect(parseExpoFontFamily('Nunito, system-ui, sans-serif')).toBeNull();
    expect(parseExpoFontFamily('ui-rounded')).toBeNull();
  });
});

describe('expoFontFaceForWeight', () => {
  test('rewrites the loaded face to match fontWeight', () => {
    expect(expoFontFaceForWeight('Nunito_400Regular', '800')).toBe(
      'Nunito_800ExtraBold'
    );
    expect(expoFontFaceForWeight('Nunito_400Regular', 600)).toBe(
      'Nunito_600SemiBold'
    );
    expect(expoFontFaceForWeight('Nunito_400Regular', 'bold')).toBe(
      'Nunito_700Bold'
    );
  });

  test('leaves non-Expo families alone', () => {
    expect(expoFontFaceForWeight('system-ui', '700')).toBeUndefined();
  });
});

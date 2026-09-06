/**
 * Expo Google Fonts postscript names (`Nunito_400Regular`). Used by the RN
 * compiler (weight → matching face) and the CSS compiler (face → family).
 */

const EXPO_FONT_RE =
  /^(.+)_(\d{3})(Regular|Medium|SemiBold|Bold|Light|Thin|Black|ExtraBold|ExtraLight)?$/;

const WEIGHT_SUFFIX: Record<string, string> = {
  '200': 'ExtraLight',
  '300': 'Light',
  '400': 'Regular',
  '500': 'Medium',
  '600': 'SemiBold',
  '700': 'Bold',
  '800': 'ExtraBold',
  '900': 'Black',
};

export type ExpoFontFace = {
  family: string;
  weight: string;
};

export function parseExpoFontFamily(fontFamily: string): ExpoFontFace | null {
  const match = EXPO_FONT_RE.exec(fontFamily);
  const family = match?.[1];
  const weight = match?.[2];
  if (family === undefined || weight === undefined) return null;
  return { family, weight };
}

function cssWeight(value: unknown): string | undefined {
  if (value === 'bold') return '700';
  if (value === 'normal') return '400';
  if (typeof value === 'number' && Number.isInteger(value)) {
    return String(value);
  }
  if (typeof value === 'string' && /^\d{3}$/.test(value)) return value;
  return undefined;
}

/**
 * Map `Family_400Regular` + `fontWeight: 800` → `Family_800ExtraBold`.
 * iOS falls back to the system font when a named face is paired with a
 * mismatched `fontWeight`.
 */
export function expoFontFaceForWeight(
  fontFamily: string,
  fontWeight: unknown
): string | undefined {
  const parsed = parseExpoFontFamily(fontFamily);
  if (parsed === null) return undefined;
  const weight = cssWeight(fontWeight);
  if (weight === undefined) return undefined;
  const suffix = WEIGHT_SUFFIX[weight];
  if (suffix === undefined) return undefined;
  return `${parsed.family}_${weight}${suffix}`;
}

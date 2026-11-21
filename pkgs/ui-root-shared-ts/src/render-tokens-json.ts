/**
 * Source of the generated `tokens.json`: every token of
 * `design-tokens.json` resolved to its final value, flat and per scheme, so
 * another client or a design tool can derive from the same values without
 * following aliases. Pure; the generator script writes it.
 */

import { COLOR_PALETTE } from './color-palette';
import { fonts } from './fonts';
import { duration } from './motion';
import {
  fontLeading,
  fontSize,
  fontWeight,
  radiusRole,
  spaceSize,
} from './scale';
import { controlSize, iconSize } from './sizes';
import { textStyles } from './typography';

function resolvedTextStyles() {
  return Object.fromEntries(
    Object.entries(textStyles).map(([name, parts]) => [
      name,
      {
        fontFamily: fonts[parts.family as keyof typeof fonts],
        fontSize: fontSize[parts.size as keyof typeof fontSize],
        fontWeight: fontWeight[parts.weight as keyof typeof fontWeight],
        lineHeight: fontLeading[parts.leading as keyof typeof fontLeading],
      },
    ])
  );
}

/** Full contents of `tokens.json`. */
export function renderTokensJson(): string {
  const tokens = {
    $description:
      'GENERATED from pkgs/ui-root-shared-ts/src/design-tokens.json — do not edit. Every value resolved; px for dimensions, ms for durations.',
    color: { dark: COLOR_PALETTE.dark, light: COLOR_PALETTE.light },
    textStyle: resolvedTextStyles(),
    font: fonts,
    space: spaceSize,
    radius: radiusRole,
    iconSize,
    controlSize,
    duration,
  };
  return `${JSON.stringify(tokens, null, 2)}\n`;
}

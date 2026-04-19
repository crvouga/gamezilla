/**
 * Global typographic casing for design-system `Text`. Configure once on {@link ThemeProvider}.
 */

import type { TextStyle } from 'react-native';

export type TextCasing = 'none' | 'lowercase' | 'uppercase' | 'capitalize';

/** Default: all system copy reads in lowercase unless a component overrides `textTransform`. */
export const defaultTextCasing: TextCasing = 'capitalize';

export function textCasingToStyle(
  casing: TextCasing
): Pick<TextStyle, 'textTransform'> {
  return {
    textTransform: casing === 'none' ? 'none' : casing,
  };
}

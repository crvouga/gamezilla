/**
 * Global typographic casing for design-system `Text`. Configure once on {@link ThemeProvider}.
 *
 * Only applied to UI-chrome variants (titles, subtitles, headings,
 * navigation titles, labels). Content variants -- `body`, `bodyBold`,
 * `caption`, `link`, `mono` -- always render verbatim so URLs, code,
 * identifiers, and proper nouns are not mangled (e.g. we must never emit
 * `Https://Api.Gamezilla.App`).
 */

import type { TextStyle } from 'react-native';

export type TextCasing = 'none' | 'lowercase' | 'uppercase' | 'capitalize';

/** Default casing for UI chrome (headers, labels, buttons). */
export const defaultTextCasing: TextCasing = 'capitalize';

export function textCasingToStyle(
  casing: TextCasing
): Pick<TextStyle, 'textTransform'> {
  return {
    textTransform: casing === 'none' ? 'none' : casing,
  };
}

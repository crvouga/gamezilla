/**
 * Global typographic casing for design-system `Text`. Configure once on {@link ThemeProvider}.
 *
 * Only applied to UI-chrome variants (titles, subtitles, headings,
 * navigation titles, labels). Content variants -- `body`, `bodyBold`,
 * `caption`, `link`, `mono` -- always render verbatim so URLs, code,
 * identifiers, and proper nouns are not mangled (e.g. we must never emit
 * `Https://Api.Example.Com`).
 */

import type { SxProps } from './sx-props';

export type TextCasing = 'none' | 'lowercase' | 'uppercase' | 'capitalize';

/**
 * Default casing for UI chrome (headers, labels, buttons). Modern systems
 * lean on sentence-case in product chrome -- `capitalize` reads dated -- so
 * the default is `'none'`. Apps can opt back in per surface via `Text`'s
 * `casing` prop or by overriding `textCasing` on the `ThemeProvider`.
 */
export const defaultTextCasing: TextCasing = 'none';

export function textCasingToStyle(casing: TextCasing): SxProps {
  return {
    textTransform: casing === 'none' ? 'none' : casing,
  };
}

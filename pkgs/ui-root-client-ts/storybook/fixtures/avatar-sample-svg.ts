/**
 * Generative-avatar stand-ins for the explorer examples. An SVG shown as an
 * `<img>` cannot read CSS variables, so the sample is drawn from the
 * resolved palette (`useThemeTokens().palette()`) instead of literal colors.
 */

import type { ColorTokens } from '@pkgs/ui-root-shared-ts/colors-types';

/** Head and shoulders on a flat plate, in two palette tones. */
export function sampleAvatarSvg(
  palette: ColorTokens,
  plate: 'info' | 'success' | 'warning' | 'destructive' | 'tintActive' = 'info'
): string {
  return [
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">',
    `<rect width="64" height="64" fill="${palette[plate]}" />`,
    `<circle cx="32" cy="26" r="10" fill="${palette.onPrimary}" />`,
    `<rect x="14" y="40" width="36" height="18" rx="9" fill="${palette.onPrimary}" />`,
    '</svg>',
  ].join('');
}

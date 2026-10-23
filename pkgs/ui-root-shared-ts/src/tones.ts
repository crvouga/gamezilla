/**
 * Which palette role each tone names, read from the `tone` aliases of
 * `design-tokens.json`: `ColorTone` `secondary` is `textSecondary`,
 * `SurfaceTone` `muted` is `surfaceMuted`. The keywords `inherit` and
 * `transparent` name no role and are absent here.
 */

import type { ColorTokenName } from './colors-types';
import { readAliasTargets } from './design-tokens';
import { tone } from './design-tokens.json';

type Roles<G> = { readonly [K in keyof G]: ColorTokenName };

function roles<G extends Readonly<Record<string, string>>>(group: G): Roles<G> {
  return group as Roles<G>;
}

/** Palette role of each text tone. */
export const textToneColor = roles(readAliasTargets(tone.text));

/** Palette role of each surface tone. */
export const surfaceToneColor = roles(readAliasTargets(tone.surface));

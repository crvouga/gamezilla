/**
 * The one soft shadow, read from `design-tokens.json`. Everything else is
 * flat with hairline borders; `float` is for surfaces that hover above the
 * content (menus, popovers, toasts, tooltips). Emitted per scheme as
 * `--ui-shadow-<name>`, with the color as `var(--ui-color-<color>)` so a
 * nested theme recomputes it.
 */

import { aliasPath, isTokenTree, readGroup } from './design-tokens';
import { color, shadow } from './design-tokens.json';

function kebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

function px(value: unknown): string {
  if (isTokenTree(value) && typeof value['value'] === 'number') {
    return `${value['value']}px`;
  }
  throw new Error(`expected a px quantity, got ${JSON.stringify(value)}`);
}

function readShadow(value: unknown): string {
  if (!isTokenTree(value)) {
    throw new Error(`expected a shadow, got ${JSON.stringify(value)}`);
  }
  const role = aliasPath(value['color'])?.split('.').at(-1);
  if (role === undefined) throw new Error('a shadow color must be an alias');
  const geometry = ['offsetX', 'offsetY', 'blur', 'spread']
    .map((key) => px(value[key]))
    .join(' ');
  return `${geometry} var(--ui-color-${kebab(role)})`;
}

/** CSS `box-shadow` per named shadow. */
export const shadowCss = readGroup({ color }, shadow, readShadow);

export type ShadowName = keyof typeof shadowCss;

/** Render layered material depths from Design Tokens shadow composites. */

import tokens from './design-tokens.json' with { type: 'json' };
import { aliasPath, isTokenTree, readGroup } from './design-tokens.ts';

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
  return `${value['inset'] === true ? 'inset ' : ''}${geometry} var(--ui-color-${kebab(role)})`;
}

/** Read compound shadows when generating stylesheets or opening documents. */
export function renderDepths() {
  return readGroup(tokens, tokens.shadow, (layers) =>
    (Array.isArray(layers) ? layers : [layers]).map(readShadow).join(', ')
  );
}

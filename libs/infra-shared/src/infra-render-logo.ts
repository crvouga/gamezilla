/**
 * Logos are defined once as `<symbol>`s at the top of the page and drawn
 * with `<use>`, so the page is one file with no network requests.
 */

import { LOGOS } from './infra-logos';
import { esc } from './infra-render-text';

const KNOWN = new Set(LOGOS.map((l) => l.id));

export function logoId(id: string): string {
  return KNOWN.has(id) ? id : 'opentofu';
}

export function logoTitle(id: string): string {
  return LOGOS.find((l) => l.id === logoId(id))?.title ?? id;
}

/** The hidden sprite sheet; place once, right after `<body>`. */
export function logoSprite(): string {
  const symbols = LOGOS.map((logo) => {
    const fill = logo.color === null ? '' : ` fill="${esc(logo.color)}"`;
    return `<symbol id="logo-${esc(logo.id)}" viewBox="${esc(logo.viewBox)}"><g${fill}>${logo.body}</g></symbol>`;
  }).join('');
  return `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>${symbols}</defs></svg>`;
}

/** An inline logo inside a white tile (HTML context). */
export function logoTile(id: string, size = 28): string {
  const real = logoId(id);
  const inner = Math.round(size * 0.68);
  return `<span class="logo-tile" style="width:${size}px;height:${size}px" title="${esc(logoTitle(real))}"><svg width="${inner}" height="${inner}" role="img" aria-label="${esc(logoTitle(real))}"><use href="#logo-${esc(real)}" width="${inner}" height="${inner}"/></svg></span>`;
}

/** A logo drawn at `x`,`y` inside an SVG graph. */
export function logoSvg(
  id: string,
  x: number,
  y: number,
  size: number
): string {
  const real = logoId(id);
  return `<use href="#logo-${esc(real)}" x="${x}" y="${y}" width="${size}" height="${size}"/>`;
}

export function logoRow(ids: readonly string[], size = 20): string {
  return `<span class="logo-row">${[...new Set(ids)].map((id) => logoTile(id, size)).join('')}</span>`;
}

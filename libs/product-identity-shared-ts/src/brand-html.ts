/**
 * HTML shells (`index.html`) cannot import the identity, so they spell
 * `%BRAND_NAME%` and `%BRAND_THEME_COLOR%`, and the build replaces them
 * (`brandHtmlPlugin` for Vite, `renderBrandHtml` anywhere else).
 */
import { PRODUCT, type ProductIdentity } from './product-identity.ts';

export function renderBrandHtml(
  html: string,
  identity: ProductIdentity = PRODUCT
): string {
  return html
    .replaceAll('%BRAND_NAME%', escapeHtml(identity.brand.name))
    .replaceAll('%BRAND_THEME_COLOR%', identity.brand.themeColor);
}

/** A Vite plugin (structurally typed: no Vite import here). */
export function brandHtmlPlugin(identity: ProductIdentity = PRODUCT): {
  readonly name: string;
  readonly transformIndexHtml: (html: string) => string;
} {
  return {
    name: 'product-identity-html',
    transformIndexHtml: (html) => renderBrandHtml(html, identity),
  };
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

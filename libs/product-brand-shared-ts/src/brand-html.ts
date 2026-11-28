/**
 * HTML shells (`index.html`) cannot import the identity, so the build replaces
 * their `%BRAND_NAME%` placeholder
 * (`brandHtmlPlugin` for Vite, `renderBrandHtml` anywhere else).
 */
import {
  PRODUCT,
  type ProductIdentity,
} from '@libs/product-identity-shared-ts/product-identity';

export function renderBrandHtml(
  html: string,
  identity: ProductIdentity = PRODUCT
): string {
  return html.replaceAll('%BRAND_NAME%', escapeHtml(identity.brand.name));
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

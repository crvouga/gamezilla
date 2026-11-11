import {
  PRODUCT,
  type ProductIdentity,
} from '@libs/product-identity-shared-ts/product-identity';

/** Trusted configuration artwork, labeled with the configured product name. */
export function renderBrandMark(identity: ProductIdentity = PRODUCT): string {
  const title = identity.brand.name.replaceAll(
    /[&<>"']/g,
    (character) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&apos;',
      })[character] ?? character
  );
  // The title is the opening <svg> tag's first child, wherever that tag is.
  const opening = /<svg\b[^>]*>/.exec(identity.brand.markSvg);
  if (opening === null)
    throw new Error('Brand mark artwork has no opening <svg> tag');
  const at = opening.index + opening[0].length;
  const svg = identity.brand.markSvg;
  return `${svg.slice(0, at)}<title>${title}</title>${svg.slice(at)}\n`;
}

/** The host supplies artwork to the product-agnostic design system. */
export function brandMarkSource(identity: ProductIdentity = PRODUCT): string {
  return `data:image/svg+xml,${encodeURIComponent(renderBrandMark(identity))}`;
}

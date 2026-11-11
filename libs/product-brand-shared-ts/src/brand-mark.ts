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
  return `${identity.brand.markSvg.replace('>', `><title>${title}</title>`)}\n`;
}

/** The host supplies artwork to the product-agnostic design system. */
export function brandMarkSource(identity: ProductIdentity = PRODUCT): string {
  return `data:image/svg+xml,${encodeURIComponent(renderBrandMark(identity))}`;
}

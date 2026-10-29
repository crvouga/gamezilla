/**
 * Committed files generated from the product identity, one renderer each.
 * `scripts/generate-brand-artifacts.ts` writes them; the freshness test
 * (`tests/brand-artifacts.test.ts`) fails while any differs, and the brand
 * policy accepts brand spellings in them only because of that test
 * (`@libs/product-identity/generated-artifacts.json`). The rebrand test
 * renders every one for a synthetic identity.
 */
import type { ProductIdentity } from './product-identity';

export type BrandArtifact = {
  /** Repository-relative path of the committed file. */
  readonly path: string;
  readonly render: (identity: ProductIdentity) => string;
};

/** Every generated brand artifact. Platform modules add their entries here. */
export const BRAND_ARTIFACTS: readonly BrandArtifact[] = [];

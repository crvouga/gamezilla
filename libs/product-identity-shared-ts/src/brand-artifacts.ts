/**
 * Committed files generated from the product identity, one renderer each.
 * `scripts/generate-brand-artifacts.ts` writes them; the freshness test
 * (`tests/brand-artifacts.test.ts`) fails while any differs, and the brand
 * policy accepts brand spellings in them only because of that test
 * (`@libs/product-identity/generated-artifacts.json`). The rebrand test
 * renders every one for a synthetic identity.
 */
import { APPLE_BRAND_ARTIFACTS } from './brand-artifact-apple.ts';
import { WEB_BRAND_ARTIFACTS } from './brand-artifact-web.ts';
import type { ProductIdentity } from './product-identity.ts';

export type BrandArtifact = {
  /** Repository-relative path of the committed file. */
  readonly path: string;
  readonly render: (identity: ProductIdentity) => string;
};

/** Every generated brand artifact, from each platform's module. */
export const BRAND_ARTIFACTS: readonly BrandArtifact[] = [
  ...WEB_BRAND_ARTIFACTS,
  ...APPLE_BRAND_ARTIFACTS,
];

// @io-wall-ok — reads the committed generated artifacts.
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_ARTIFACTS } from '@libs/product-identity-shared-ts/brand-artifacts';
import { PRODUCT } from '@libs/product-identity-shared-ts/product-identity';
import { syntheticIdentity } from '@libs/product-identity-shared-ts/synthetic-identity';

const ROOT = join(import.meta.dir, '../../..');
const FIX =
  'bun run libs/product-identity-shared-ts/scripts/generate-brand-artifacts.ts';

describe('generated brand artifacts', () => {
  for (const artifact of BRAND_ARTIFACTS)
    test(`${artifact.path} is exactly what the identity generates (${FIX})`, () => {
      const path = join(ROOT, artifact.path);
      expect(existsSync(path)).toBe(true);
      expect(readFileSync(path, 'utf8')).toBe(artifact.render(PRODUCT));
    });

  test('every artifact follows a rebrand and keeps no trace of the old brand', () => {
    const synthetic = syntheticIdentity();
    // External identifiers survive a rebrand by design (the bundle id may
    // contain the old domain as text); everything else must follow it.
    const external = [
      synthetic.external.appleBundleId,
      synthetic.external.deepLinkScheme,
      synthetic.external.sourceRepository,
    ].sort((a, b) => b.length - a.length);
    for (const artifact of BRAND_ARTIFACTS) {
      let text = artifact.render(synthetic);
      for (const value of external) text = text.replaceAll(value, '');
      expect(text).not.toContain(PRODUCT.brand.name);
      expect(text).not.toContain(PRODUCT.brand.domain);
      // …and shows the new brand (its name or its domain).
      const rendered = artifact.render(synthetic);
      expect(
        rendered.includes(synthetic.brand.name) ||
          rendered.includes(synthetic.brand.domain)
      ).toBe(true);
    }
  });
});

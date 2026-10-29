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
    for (const artifact of BRAND_ARTIFACTS) {
      const text = artifact.render(synthetic);
      expect(text).not.toContain(PRODUCT.brand.name);
      expect(text).not.toContain(PRODUCT.brand.domain);
    }
  });
});

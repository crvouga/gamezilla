#!/usr/bin/env bun
// @io-wall-ok — CLI: writes the generated brand artifacts.
/**
 * Rewrites every generated brand artifact from `product-identity.json`:
 *
 *   bun run libs/product-identity-shared-ts/scripts/generate-brand-artifacts.ts
 *
 * Same identity, same bytes. `tests/brand-artifacts.test.ts` fails while any
 * committed artifact differs from what this writes.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { BRAND_ARTIFACTS } from '../src/brand-artifacts';
import { PRODUCT } from '../src/product-identity';

const ROOT = join(import.meta.dirname, '../../..');

for (const artifact of BRAND_ARTIFACTS) {
  const path = join(ROOT, artifact.path);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, artifact.render(PRODUCT));
  console.log(`wrote ${artifact.path}`);
}

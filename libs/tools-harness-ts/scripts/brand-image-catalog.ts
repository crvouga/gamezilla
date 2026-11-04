// @io-wall-ok — CLI catalog adapter: one committed definition per generated image.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { BrandImageArtifact } from './brand-image-artifacts';

const directory = join(import.meta.dirname, '../brand/web-image-artifacts');

export const BRAND_IMAGE_ARTIFACTS: readonly BrandImageArtifact[] = readdirSync(
  directory
)
  .filter((name) => name.endsWith('.json'))
  .sort()
  .map(
    (name) =>
      JSON.parse(
        readFileSync(join(directory, name), 'utf8')
      ) as BrandImageArtifact
  );

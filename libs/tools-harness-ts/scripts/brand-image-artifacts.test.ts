// @io-wall-ok — generated image freshness and decoded pixel evidence.
import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BRAND_ARTIFACTS } from '@libs/product-brand-shared-ts/brand-artifacts';
import {
  brandMarkSource,
  renderBrandMark,
} from '@libs/product-brand-shared-ts/brand-mark';
import { syntheticIdentity } from '@libs/product-brand-shared-ts/synthetic-identity';
import { PRODUCT } from '@libs/product-identity-shared-ts/product-identity';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';
import sharp from 'sharp';
import { renderBrandImage } from './brand-image-artifacts';
import { BRAND_IMAGE_ARTIFACTS } from './brand-image-catalog';

const ROOT = join(import.meta.dirname, '../../..');

test('every web install image and source icon belongs to the generated catalog', () => {
  const pwa = 'apps/client-ts/public/pwa';
  const source = 'apps/client-ts/src';
  const actual = [
    ...readdirSync(join(ROOT, pwa))
      .filter((name) => /\.(png|svg|ico)$/.test(name))
      .map((name) => `${pwa}/${name}`),
    ...readdirSync(join(ROOT, source))
      .filter((name) => name.includes('icon') && name.endsWith('.png'))
      .map((name) => `${source}/${name}`),
    'apps/client-ts/public/favicon.ico',
    'apps/product-ts/public/favicon.ico',
  ];
  const declared = [
    ...BRAND_IMAGE_ARTIFACTS.map((artifact) => artifact.path),
    ...BRAND_ARTIFACTS.filter((artifact) => artifact.path.endsWith('.svg')).map(
      (artifact) => artifact.path
    ),
  ];
  expect(actual.sort()).toEqual(declared.sort());
});

test('generated colors and transparency follow configuration across image variants', async () => {
  await assertProperty(
    'configured mark, background and transparency survive rasterization',
    fc.asyncProperty(
      fc.record({
        background: fc.tuple(
          ...Array.from({ length: 3 }, () => fc.integer({ min: 0, max: 255 }))
        ),
        transparent: fc.boolean(),
        backgroundOnly: fc.boolean(),
      }),
      async (sample) => {
        const identity = syntheticIdentity();
        const artifact = {
          path: 'icon.png',
          width: 64,
          height: 64,
          splash: false,
          ...sample,
        };
        const backgroundColor = `#${sample.background.map((byte) => byte.toString(16).padStart(2, '0')).join('')}`;
        const png = await renderBrandImage(artifact, {
          ...identity,
          brand: { ...identity.brand, backgroundColor },
        });
        const pixels = await sharp(png).ensureAlpha().raw().toBuffer();
        const corner = sample.transparent
          ? [0, 0, 0, 0]
          : [...sample.background, 255];
        expect([...pixels.subarray(0, 4)]).toEqual(corner);
        const center = (32 * 64 + 32) * 4;
        expect([...pixels.subarray(center, center + 4)]).toEqual(
          sample.backgroundOnly ? corner : [0, 0, 255, 255]
        );
      }
    )
  );
});

describe('configured brand artwork', () => {
  for (const artifact of BRAND_IMAGE_ARTIFACTS)
    test(`${artifact.path} matches the configured mark and background`, async () => {
      const actual = readFileSync(join(ROOT, artifact.path));
      expect(actual.equals(await renderBrandImage(artifact, PRODUCT))).toBe(
        true
      );
    });

  test('header artwork carries the configured SVG and accessible product name', () => {
    const identity = syntheticIdentity();
    expect(
      decodeURIComponent(brandMarkSource(identity).split(',')[1] ?? '')
    ).toBe(renderBrandMark(identity));
    expect(renderBrandMark(identity)).toContain(
      identity.brand.markSvg.split('>').slice(1).join('>')
    );
    expect(renderBrandMark(identity)).toContain(
      `<title>${identity.brand.name}</title>`
    );
  });

  test('configuration changes the actual icon pixels, including the background', async () => {
    // regression: brand-artwork-not-configurable
    const identity = syntheticIdentity();
    const artifact = { path: 'icon.png', width: 64, height: 64, splash: false };
    const png = await renderBrandImage(artifact, {
      ...identity,
      brand: { ...identity.brand, backgroundColor: '#ff0000' },
    });
    const { data, info } = await sharp(png)
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([...data.subarray(0, 3)]).toEqual([255, 0, 0]);
    const center = (32 * info.width + 32) * info.channels;
    expect([...data.subarray(center, center + 3)]).toEqual([0, 0, 255]);
  });
});

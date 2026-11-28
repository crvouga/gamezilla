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
import { readTurboTasks } from './turbo-config';

const ROOT = join(import.meta.dirname, '../../..');

test('every web install image and source icon belongs to the generated catalog', () => {
  const pwa = 'apps/product-client-ts/public/pwa';
  const source = 'apps/product-client-ts/src';
  const actual = [
    ...readdirSync(join(ROOT, pwa))
      .filter((name) => /\.(png|svg|ico)$/.test(name))
      .map((name) => `${pwa}/${name}`),
    ...readdirSync(join(ROOT, source))
      .filter((name) => name.includes('icon') && name.endsWith('.png'))
      .map((name) => `${source}/${name}`),
    'apps/product-client-ts/public/favicon.ico',
    'apps/product-ts/public/favicon.ico',
    'apps/product-client-swift/src/assets.xcassets/app-icon.appiconset/app-icon.png',
    'apps/product-client-swift/src/assets.xcassets/brand-mark.imageset/mark.svg',
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

// regression: brand-artwork-test-reads-stale-generation
test('the tests regenerate the artwork they compare under the current identity', () => {
  // CI materialized a fixture identity, generated the artwork, then
  // materialized the configured one: without this edge the comparison read
  // the fixture's icons against the configured brand.
  expect(
    readTurboTasks(ROOT)['@libs/tools-harness-ts#test']?.dependsOn
  ).toContain('generate:brand-artifacts');
});

describe('configured brand artwork', () => {
  for (const artifact of BRAND_IMAGE_ARTIFACTS)
    test(`${artifact.path} matches the configured mark and background`, async () => {
      const actual = readFileSync(join(ROOT, artifact.path));
      expect(actual.equals(await renderBrandImage(artifact, PRODUCT))).toBe(
        true
      );
    });

  test('browser favicons contain a transparent 16 px PNG at the declared offset', async () => {
    for (const path of ['apps/product-client-ts', 'apps/product-ts']) {
      const ico = readFileSync(join(ROOT, path, 'public/favicon.ico'));
      expect([...ico.subarray(6, 8)]).toEqual([16, 16]);
      const png = ico.subarray(ico.readUInt32LE(18));
      expect(await sharp(png).metadata()).toMatchObject({
        width: 16,
        height: 16,
        hasAlpha: true,
      });
    }
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

  test('fine details drop out of the favicon but survive on the install icon', async () => {
    const identity = syntheticIdentity();
    const mark =
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" fill="red"/><circle class="fine-detail" cx="16" cy="16" r="5" fill="blue"/></svg>';
    const brand = { ...identity.brand, markSvg: mark };
    for (const size of [16, 64]) {
      const artifact = {
        path: 'icon.png',
        width: size,
        height: size,
        splash: false,
      };
      const image = await renderBrandImage(artifact, { ...identity, brand });
      const pixel = await sharp(image)
        .extract({ left: size / 2, top: size / 2, width: 1, height: 1 })
        .removeAlpha()
        .raw()
        .toBuffer();
      expect([...pixel]).toEqual(size === 16 ? [255, 0, 0] : [0, 0, 255]);
    }
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

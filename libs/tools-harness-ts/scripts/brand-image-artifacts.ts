import { renderBrandMark } from '@libs/product-identity-shared-ts/brand-mark';
import type { ProductIdentity } from '@libs/product-identity-shared-ts/product-identity';
import sharp from 'sharp';

export type BrandImageArtifact = {
  readonly path: string;
  readonly width: number;
  readonly height: number;
  readonly splash: boolean;
  readonly backgroundOnly?: boolean;
  readonly transparent?: boolean;
};

function iconContainer(png: Buffer, size: number): Buffer {
  const header = Buffer.alloc(22);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(1, 4);
  header[6] = size;
  header[7] = size;
  header.writeUInt16LE(1, 10);
  header.writeUInt16LE(32, 12);
  header.writeUInt32LE(png.length, 14);
  header.writeUInt32LE(header.length, 18);
  return Buffer.concat([header, png]);
}

/** Install icons and launch images always use the configured mark and background. */
export async function renderBrandImage(
  artifact: BrandImageArtifact,
  identity: ProductIdentity
): Promise<Buffer> {
  const side = Math.min(artifact.width, artifact.height);
  const markSize = Math.max(
    1,
    Math.floor(side * (artifact.splash ? 0.28 : 0.8))
  );
  const mark = await sharp(Buffer.from(renderBrandMark(identity)))
    .resize(markSize, markSize)
    .png()
    .toBuffer();
  const png = await sharp({
    create: {
      width: artifact.width,
      height: artifact.height,
      channels: 4,
      background: artifact.transparent
        ? { r: 0, g: 0, b: 0, alpha: 0 }
        : identity.brand.backgroundColor,
    },
  })
    .composite(
      artifact.backgroundOnly ? [] : [{ input: mark, gravity: 'centre' }]
    )
    .png({ compressionLevel: 6, adaptiveFiltering: false })
    .toBuffer();
  return artifact.path.endsWith('.ico')
    ? iconContainer(png, artifact.width)
    : png;
}

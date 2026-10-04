import sharp from 'sharp';
import type { ImageInput, RgbImage } from '@pkgs/ui-quality-check-shared/detectors-types';
import type { Files } from './files';
import { readBytes } from './files';

export async function decodeImage(
  files: Files,
  input: ImageInput,
  signal?: AbortSignal
): Promise<RgbImage> {
  signal?.throwIfAborted();
  if (typeof input !== 'string' && !(input instanceof Uint8Array)) {
    if (
      !Number.isInteger(input.width) ||
      !Number.isInteger(input.height) ||
      input.width < 1 ||
      input.height < 1 ||
      input.width * input.height > 40_000_000 ||
      input.data.length !== input.width * input.height * 3
    )
      throw new Error(
        'RGB image requires positive dimensions and exactly width × height × 3 bytes (maximum 40 million pixels).'
      );
    return input;
  }
  const bytes =
    typeof input === 'string' ? await readBytes(files, input) : input;
  try {
    const metadata = await sharp(bytes, {
      limitInputPixels: 40_000_000,
    }).metadata();
    if (!['png', 'jpeg'].includes(metadata.format ?? ''))
      throw new Error('Unsupported image encoding.');
    const decoded = await sharp(bytes, {
      limitInputPixels: 40_000_000,
      failOn: 'error',
    })
      .rotate()
      .flatten({ background: '#ffffff' })
      .removeAlpha()
      .toColourspace('srgb')
      .raw()
      .toBuffer({ resolveWithObject: true });
    signal?.throwIfAborted();
    return {
      data: decoded.data,
      width: decoded.info.width,
      height: decoded.info.height,
    };
  } catch (error) {
    signal?.throwIfAborted();
    throw new Error(
      `Cannot decode image ${typeof input === 'string' ? input : '(bytes)'}. Expected PNG or JPEG.`,
      { cause: error }
    );
  }
}

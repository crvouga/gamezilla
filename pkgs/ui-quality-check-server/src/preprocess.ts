import type { RgbImage } from '@pkgs/ui-quality-check-shared/detectors-types';
import sharp from 'sharp';

const SIZE = 224;
const MEAN = [0.48145466, 0.4578275, 0.40821073] as const;
const STD = [0.26862954, 0.26130258, 0.27577711] as const;

/** Versioned bicubic RGB resize + overlapping windows; covers the entire UI. */
export async function imageWindows(
  image: RgbImage
): Promise<readonly Float32Array[]> {
  const ratio = image.width / image.height;
  const width = ratio > 1 ? Math.floor(ratio * SIZE) : SIZE;
  const height = ratio > 1 ? SIZE : Math.floor(SIZE / ratio);
  if (Math.max(width, height) > 4096)
    throw new Error(
      'Image aspect ratio exceeds the supported 4096:224 window budget. Split unusually long screenshots.'
    );
  const pixels = await sharp(image.data, {
    raw: { width: image.width, height: image.height, channels: 3 },
  })
    .resize(width, height, { fit: 'fill', kernel: 'cubic' })
    .raw()
    .toBuffer();
  const length = Math.max(width, height);
  const steps = Math.ceil(length / SIZE);
  const offsets =
    steps === 1
      ? [0]
      : Array.from({ length: steps }, (_, i) =>
          Math.round((i * (length - SIZE)) / (steps - 1))
        );
  return offsets.map((offset) =>
    windowTensor({
      pixels,
      width,
      left: width > height ? offset : 0,
      top: height > width ? offset : 0,
    })
  );
}

function windowTensor(args: {
  pixels: Uint8Array;
  width: number;
  left: number;
  top: number;
}): Float32Array {
  const tensor = new Float32Array(3 * SIZE * SIZE);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const pixel = ((args.top + y) * args.width + args.left + x) * 3;
      for (let c = 0; c < 3; c++)
        tensor[c * SIZE * SIZE + y * SIZE + x] =
          ((args.pixels[pixel + c] ?? 0) / 255 - (MEAN[c] ?? 0)) /
          (STD[c] ?? 1);
    }
  }
  return tensor;
}

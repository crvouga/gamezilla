import { expect, test } from 'bun:test';
import { imageWindows } from '@pkgs/ui-quality-check-server/preprocess';
import sharp from 'sharp';

// regression: ui-quality-window-preprocessing-timeout
// Cover every byte/channel and both window axes, including overlapping windows
// and actual resize. The optimized path must retain the original tensor bits.
test.each([
  [224, 224],
  [224, 448],
  [448, 224],
  [224, 300],
  [300, 224],
  [320, 640],
])(
  'window preprocessing preserves bicubic RGB tensors for %i × %i',
  async (width, height) => {
    const data = Uint8Array.from(
      { length: width * height * 3 },
      (_, i) => i % 256
    );
    const scaledWidth =
      width > height ? Math.floor((width / height) * 224) : 224;
    const scaledHeight =
      width > height ? 224 : Math.floor((height / width) * 224);
    const pixels = await sharp(data, { raw: { width, height, channels: 3 } })
      .resize(scaledWidth, scaledHeight, { fit: 'fill', kernel: 'cubic' })
      .raw()
      .toBuffer();
    const actual = await imageWindows({ width, height, data });
    const count = Math.ceil(Math.max(scaledWidth, scaledHeight) / 224);
    expect(actual).toHaveLength(count);
    for (let window = 0; window < count; window++) {
      const offset =
        count === 1
          ? 0
          : Math.round(
              (window * (Math.max(scaledWidth, scaledHeight) - 224)) /
                (count - 1)
            );
      const left = scaledWidth > scaledHeight ? offset : 0;
      const top = scaledHeight > scaledWidth ? offset : 0;
      const expected = new Float32Array(3 * 224 * 224);
      for (let y = 0; y < 224; y++) {
        for (let x = 0; x < 224; x++) {
          const pixel = ((y + top) * scaledWidth + x + left) * 3;
          for (let c = 0; c < 3; c++) {
            expected[c * 224 * 224 + y * 224 + x] =
              (pixels[pixel + c]! / 255 -
                [0.48145466, 0.4578275, 0.40821073][c]!) /
              [0.26862954, 0.26130258, 0.27577711][c]!;
          }
        }
      }
      expect(actual[window]).toEqual(expected);
    }
  }
);

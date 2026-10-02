import type { RgbImage } from '../detectors/types';

/** Deterministic 64×64 RGB grid, with local tile differences to retain small defects. */
export function fingerprint(image: RgbImage): Uint8Array {
  const out = new Uint8Array(64 * 64 * 3);
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const pixel = (Math.min(image.height - 1, Math.floor((y + 0.5) * image.height / 64)) * image.width + Math.min(image.width - 1, Math.floor((x + 0.5) * image.width / 64))) * 3;
      const dest = (y * 64 + x) * 3;
      out[dest] = image.data[pixel] ?? 0; out[dest + 1] = image.data[pixel + 1] ?? 0; out[dest + 2] = image.data[pixel + 2] ?? 0;
    }
  }
  return out;
}

export function similar(a: Uint8Array, b: Uint8Array, threshold: number): boolean {
  if (threshold === 0) return false;
  const tiles = new Float64Array(64);
  let sum = 0;
  for (let i = 0; i < a.length; i++) {
    const diff = Math.abs((a[i] ?? 0) - (b[i] ?? 0));
    const pixel = Math.floor(i / 3);
    const tile = Math.floor(pixel / 64 / 8) * 8 + Math.floor(pixel % 64 / 8);
    tiles[tile] = (tiles[tile] ?? 0) + diff; sum += diff;
  }
  return sum / a.length / 255 <= threshold && Math.max(...tiles) / (8 * 8 * 3 * 255) <= threshold * 4;
}

/** Only near-uniform neutral black/white is empty; saturated splash screens remain UI. */
export function isEmpty(image: RgbImage): boolean {
  const samples = fingerprint(image);
  let min = 255; let max = 0;
  for (const value of samples) { min = Math.min(min, value); max = Math.max(max, value); }
  return max - min <= 2 && (max <= 3 || min >= 252);
}

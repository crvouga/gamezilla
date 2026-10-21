import type {
  QualityDetector,
  RgbImage,
} from '@pkgs/ui-quality-check-shared-ts/detectors-types';
import type { CheckerOptions } from '@pkgs/ui-quality-check-shared-ts/ui-quality-check-types';
import type { VideoDecoder } from '@pkgs/ui-quality-check-shared-ts/video-types';

export function rgb(red: number): RgbImage {
  const data = new Uint8Array(64 * 64 * 3);
  for (let i = 0; i < data.length; i += 3) {
    data[i] = red;
    data[i + 1] = 40;
    data[i + 2] = 80;
  }
  return { data, width: 64, height: 64 };
}

export function detector(id = 'fixture-score', quality?: number) {
  const calls: number[] = [];
  let initialized = 0;
  let disposed = 0;
  const value: QualityDetector = {
    info: { id, version: '1', executionProvider: 'in-process' },
    async initialize() {
      initialized++;
    },
    async score(images) {
      calls.push(images.length);
      return images.map((image) => ({
        quality: quality ?? (image.data[0] ?? 0) / 255,
      }));
    },
    async dispose() {
      disposed++;
    },
  };
  return {
    value,
    calls,
    initialized: () => initialized,
    disposed: () => disposed,
  };
}

export function decoder(
  frames: readonly { timestampMs: number; image: RgbImage }[]
) {
  let closed = 0;
  let active = 0;
  let peak = 0;
  const value: VideoDecoder = {
    version: 'fixture-rgb-v1',
    async open(_input, options) {
      return {
        durationMs: (frames.at(-1)?.timestampMs ?? 0) + 250,
        frames: (async function* () {
          active++;
          peak = Math.max(peak, active);
          let previous = -Infinity;
          try {
            for (const frame of frames) {
              options.signal?.throwIfAborted();
              if (frame.timestampMs - previous < 1000 / options.samplingFps)
                continue;
              previous = frame.timestampMs;
              yield { ...frame.image, timestampMs: frame.timestampMs };
            }
          } finally {
            active--;
            closed++;
          }
        })(),
      };
    },
  };
  return { value, closed: () => closed, peak: () => peak };
}

export function options(
  value: QualityDetector,
  decode?: VideoDecoder
): CheckerOptions {
  return {
    threshold: 0.65,
    detectors: [value],
    clock: { now: () => 0 },
    ...(decode ? { decoder: decode } : {}),
  };
}

import type { NdjsonFrame } from './frames';

/**
 * Serialize one NDJSON frame to a single newline-terminated line.
 * Always emits exactly one trailing `\n` so receivers can split on
 * newlines without special-casing the last frame.
 */
export function encodeNdjsonFrame<T>(frame: NdjsonFrame<T>): string {
  return `${JSON.stringify(frame)}\n`;
}

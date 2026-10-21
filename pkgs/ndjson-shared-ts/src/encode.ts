import type { NdjsonFrame } from './frames';

/**
 * Serialize one indexed stream frame as a single SSE event.
 * Emits `data: <json>\n\n` so receivers can split on event boundaries
 * and browser DevTools can parse the stream.
 */
export function encodeNdjsonFrame<T>(frame: NdjsonFrame<T>): string {
  return `data: ${JSON.stringify(frame)}\n\n`;
}

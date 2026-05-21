import { Buffer as BufferImpl } from 'buffer';

/**
 * Hermes / RN omit Node's `Buffer`. Room wire helpers and `timingSafeEqual`
 * use `Buffer.from` on globalThis.
 */
export function polyfillBuffer(): void {
  const g = globalThis as typeof globalThis & { Buffer?: typeof BufferImpl };
  if (typeof g.Buffer !== 'undefined') {
    return;
  }
  g.Buffer = BufferImpl;

  if (typeof global !== 'undefined' && global !== g) {
    const gg = global as typeof globalThis & { Buffer?: typeof BufferImpl };
    if (typeof gg.Buffer === 'undefined') {
      gg.Buffer = BufferImpl;
    }
  }
}

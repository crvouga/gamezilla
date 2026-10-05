import { Buffer as BufferImpl } from 'buffer/index.js';

/**
 * Some web runtimes omit Node's `Buffer`. Room wire helpers and
 * `timingSafeEqual` use `Buffer.from` on globalThis.
 */
export function polyfillBuffer(): void {
  const g = globalThis as unknown as { Buffer?: typeof BufferImpl };
  if (typeof g.Buffer !== 'undefined') {
    return;
  }
  g.Buffer = BufferImpl;

  if (typeof global !== 'undefined') {
    const gg = global as unknown as { Buffer?: typeof BufferImpl };
    if (gg !== g && typeof gg.Buffer === 'undefined') {
      gg.Buffer = BufferImpl;
    }
  }
}

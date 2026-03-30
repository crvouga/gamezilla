import { getRandomValues, randomUUID } from 'expo-crypto';

export function polyfillCrypto() {
  const g = globalThis as typeof globalThis & { crypto?: Crypto };

  if (typeof g.crypto?.randomUUID !== 'function') {
    const impl = {
      randomUUID: () => randomUUID(),
      getRandomValues: (array: ArrayBufferView) =>
        getRandomValues(
          array as Parameters<typeof getRandomValues>[0]
        ) as ArrayBufferView,
    } as Crypto;
    Object.defineProperty(g, 'crypto', {
      value: impl,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  }
}

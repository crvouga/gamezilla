import { getRandomValues, randomUUID } from 'expo-crypto';

function installCrypto(target: typeof globalThis) {
  const impl = {
    randomUUID: () => randomUUID(),
    getRandomValues: (array: ArrayBufferView) =>
      getRandomValues(
        array as Parameters<typeof getRandomValues>[0]
      ) as ArrayBufferView,
  } as Crypto;
  Object.defineProperty(target, 'crypto', {
    value: impl,
    configurable: true,
    enumerable: true,
    writable: true,
  });
}

export function polyfillCrypto() {
  const g = globalThis as typeof globalThis & { crypto?: Crypto };

  if (typeof g.crypto?.randomUUID === 'function') {
    return;
  }

  installCrypto(g);

  // Hermes / legacy RN: `global` may not be identical to `globalThis`.
  if (typeof global !== 'undefined' && global !== g) {
    const gg = global as typeof globalThis & { crypto?: Crypto };
    if (typeof gg.crypto?.randomUUID !== 'function') {
      installCrypto(gg);
    }
  }
}

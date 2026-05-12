import {
  CryptoDigestAlgorithm,
  digest as expoDigest,
  getRandomValues,
  randomUUID,
} from 'expo-crypto';

type CryptoTarget = typeof globalThis & { crypto?: Crypto };

const SUBTLE_DIGEST_ALGORITHMS: Readonly<Record<string, CryptoDigestAlgorithm>> =
  {
    'SHA-1': CryptoDigestAlgorithm.SHA1,
    'SHA-256': CryptoDigestAlgorithm.SHA256,
    'SHA-384': CryptoDigestAlgorithm.SHA384,
    'SHA-512': CryptoDigestAlgorithm.SHA512,
  };

function normaliseAlgorithm(algorithm: AlgorithmIdentifier): string {
  const name = typeof algorithm === 'string' ? algorithm : algorithm.name;
  return name.toUpperCase();
}

function bufferSourceToBytes(data: BufferSource): Uint8Array<ArrayBuffer> {
  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data);
  }
  // Copy into a fresh `ArrayBuffer`-backed view — `SharedArrayBuffer` views
  // and non-zero offsets aren't accepted by `expo-crypto.digest`'s
  // `BufferSource` parameter.
  const view = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
  const copy = new Uint8Array(view.byteLength);
  copy.set(view);
  return copy;
}

async function subtleDigest(
  algorithm: AlgorithmIdentifier,
  data: BufferSource
): Promise<ArrayBuffer> {
  const name = normaliseAlgorithm(algorithm);
  const expoAlgorithm = SUBTLE_DIGEST_ALGORITHMS[name];
  if (expoAlgorithm === undefined) {
    throw new Error(
      `crypto.subtle.digest polyfill: unsupported algorithm "${name}"`
    );
  }
  return expoDigest(expoAlgorithm, bufferSourceToBytes(data));
}

function installCrypto(target: CryptoTarget) {
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

function installSubtleDigest(target: CryptoTarget) {
  const cryptoObj = target.crypto;
  if (cryptoObj === undefined) return;
  if (typeof cryptoObj.subtle?.digest === 'function') return;

  // `crypto` and `crypto.subtle` are read-only on some hosts; route through
  // `Object.defineProperty` so we work on RN's native `crypto` object too.
  const existingSubtle = cryptoObj.subtle as SubtleCrypto | undefined;
  const subtleImpl =
    existingSubtle ??
    ({} as SubtleCrypto & { digest: typeof subtleDigest });
  Object.defineProperty(subtleImpl, 'digest', {
    value: subtleDigest,
    configurable: true,
    enumerable: true,
    writable: true,
  });
  if (existingSubtle === undefined) {
    Object.defineProperty(cryptoObj, 'subtle', {
      value: subtleImpl,
      configurable: true,
      enumerable: true,
      writable: true,
    });
  }
}

export function polyfillCrypto() {
  const g = globalThis as CryptoTarget;

  if (typeof g.crypto?.randomUUID !== 'function') {
    installCrypto(g);
  }
  installSubtleDigest(g);

  // Hermes / legacy RN: `global` may not be identical to `globalThis`.
  if (typeof global !== 'undefined' && global !== g) {
    const gg = global as CryptoTarget;
    if (typeof gg.crypto?.randomUUID !== 'function') {
      installCrypto(gg);
    }
    installSubtleDigest(gg);
  }
}

/** Resolve a harness seed to a non-zero bigint (room/sync-engine style). */

export function resolveSeed(seed: number | bigint | string): bigint {
  if (typeof seed === 'bigint') return seed === 0n ? 1n : seed;
  if (typeof seed === 'string') {
    let h = 0xcbf29ce484222325n;
    for (let i = 0; i < seed.length; i += 1) {
      h ^= BigInt(seed.charCodeAt(i));
      h = (h * 0x100000001b3n) & 0xffffffffffffffffn;
    }
    return h === 0n ? 1n : h;
  }
  const asInt = BigInt(Math.floor(Math.abs(seed))) & 0xffffffffffffffffn;
  return asInt === 0n ? 1n : asInt;
}

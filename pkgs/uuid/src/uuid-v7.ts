import { assertUuid } from './uuid';

/** Pure UUIDv7 mint: injected epoch milliseconds + injected UUID entropy. */
export function createUuidV7(nowMs: number, entropyUuid: string): string {
  assertUuid(entropyUuid, 'UUIDv7 entropy must be a UUID');
  const timestamp = BigInt(Math.max(0, Math.floor(nowMs))) & 0xffffffffffffn;
  // Lower-case so the id is canonical even when the entropy uuid is not.
  const entropy = entropyUuid.toLowerCase().replaceAll('-', '');
  const timeHex = timestamp.toString(16).padStart(12, '0');
  const randomA = `7${entropy.slice(13, 16)}`;
  const variant = (Number.parseInt(entropy[16] ?? '0', 16) & 0x3) | 0x8;
  return `${timeHex.slice(0, 8)}-${timeHex.slice(8)}-${randomA}-${variant.toString(16)}${entropy.slice(17, 20)}-${entropy.slice(20, 32)}`;
}

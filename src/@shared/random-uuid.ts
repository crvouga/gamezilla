/**
 * UUID v4 suitable for DB ids. Prefer {@link Crypto.randomUUID} when available;
 * falls back for non-secure contexts where `randomUUID` throws or is missing (e.g. `file://`).
 */
export function randomUuidV4(): string {
  const c = globalThis.crypto;
  if (c !== undefined && typeof c.randomUUID === 'function') {
    try {
      return c.randomUUID();
    } catch {
      /* non-secure context */
    }
  }
  if (c !== undefined && typeof c.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    c.getRandomValues(bytes);
    const b6 = bytes[6] ?? 0;
    const b8 = bytes[8] ?? 0;
    bytes[6] = (b6 & 0x0f) | 0x40;
    bytes[8] = (b8 & 0x3f) | 0x80;
    const p = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join(
      ''
    );
    return `${p.slice(0, 8)}-${p.slice(8, 12)}-${p.slice(12, 16)}-${p.slice(16, 20)}-${p.slice(20)}`;
  }
  return `uuid-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

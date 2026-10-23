/** Tempo's protobuf JSON encodes ids as bytes; OTLP JSON uses hex. */
export function normalizeId(value: unknown, bytes: number): string | undefined {
  if (typeof value !== 'string') return undefined;
  if (value.length !== Math.ceil(bytes / 3) * 4 || !value.endsWith('='))
    return value;
  try {
    const decoded = atob(value);
    if (decoded.length !== bytes) return value;
    return Array.from(decoded, (char) =>
      char.charCodeAt(0).toString(16).padStart(2, '0')
    ).join('');
  } catch {
    return value;
  }
}

import { assert } from '@pkgs/assert';

export const INBOX_MAX_PAYLOAD_BYTES = 4096;

export function assertBoundedPayload(
  payload: Readonly<Record<string, unknown>> | undefined
): Readonly<Record<string, unknown>> {
  const value = payload ?? {};
  const encoded = JSON.stringify(value);
  assert.ok(
    encoded.length <= INBOX_MAX_PAYLOAD_BYTES,
    `Inbox payload exceeds ${String(INBOX_MAX_PAYLOAD_BYTES)} bytes`
  );
  return value;
}

export function parseJsonObject(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return {};
    }
    return {};
  }
  if (raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return {};
}

export function parseJsonArray<T>(raw: unknown): readonly T[] {
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return Array.isArray(raw) ? (raw as T[]) : [];
}

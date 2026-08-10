import type { CreateId } from '@pkgs/uuid';

/** W3C trace id — 32 lowercase hex chars. */
export function createTraceId(createId: CreateId): string {
  return createId().replace(/-/g, '');
}

/** W3C span id — 16 lowercase hex chars. */
export function createSpanId(createId: CreateId): string {
  return createId().replace(/-/g, '').slice(0, 16);
}

import type { CreateId } from '@pkgs/uuid-shared/create-id';

/** Command id: unique per dispatch for server dedup and client queue correlation. */
export function newCommandId(createId: CreateId): string {
  return createId();
}

import type { CreateId } from '@pkgs/uuid/create-id';

/** `cus_…`, `sub_…`, `in_…`: a prefix and 24 id characters, like the wire. */
export function mintId(createId: CreateId, prefix: string): string {
  return `${prefix}_${createId().replaceAll('-', '').slice(0, 24)}`;
}

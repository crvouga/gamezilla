/**
 * Generic ABAC `entity/owner` attribute used by visibility policies to
 * scope reads/writes to the row owner. Domain-specific ABAC attributes live
 * with their owning feature packages.
 *
 * `owner` stores the owner id (account id when signed in, else install id),
 * always as a `text` value. Policies compare it against the caller's
 * `auth/my-id` claim — never against raw JSON shapes — so a typed text is
 * enough; richer shapes would belong in their own attribute.
 */
import { createAttrNamespace } from '@pkgs/attribute';

function readOwnerId(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

const entityNs = createAttrNamespace('entity');
export const AbacEntityAttr = {
  /** Indexed: ABAC visibility policies filter `WHERE entity/owner = ?` on
   * almost every read for an authenticated user — this is the hottest
   * cross-entity-type attribute in the system. */
  owner: entityNs.text('owner', readOwnerId).indexed(),
} as const;

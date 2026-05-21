/**
 * Generic ABAC `entity/owner` attribute used by visibility policies to
 * scope reads/writes to the row owner. Domain-specific ABAC attributes live
 * with their owning feature packages.
 */
import { createAttrNamespace } from '@pkgs/attribute';

const passthrough = (v: unknown) => v;

const entityNs = createAttrNamespace('entity');
export const AbacEntityAttr = {
  owner: entityNs('owner', passthrough),
} as const;

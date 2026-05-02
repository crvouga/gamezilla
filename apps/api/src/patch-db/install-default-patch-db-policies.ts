import type { PatchesDb } from '@gamezilla/patch-db/interface';
import { VisibilityPolicyRegistry } from '@gamezilla/patch-db/policy/visibility-policy-registry';
import {
  DEFAULT_PATCH_DB_VISIBILITY_POLICIES,
  type AppAuthContext,
} from './default-patch-db-policies';

const uninstallByDb = new WeakMap<PatchesDb, () => void>();

/**
 * Registers gamezilla's default ABAC visibility policies on {@link PatchesDb.hooks}.
 * Idempotent per db instance.
 */
export function installDefaultPatchDbPolicies(db: PatchesDb): () => void {
  const existing = uninstallByDb.get(db);
  if (existing !== undefined) return existing;
  const reg = new VisibilityPolicyRegistry<AppAuthContext>();
  reg.registerAll(DEFAULT_PATCH_DB_VISIBILITY_POLICIES);
  const off = reg.install(db);
  const all = () => {
    off();
    uninstallByDb.delete(db);
  };
  uninstallByDb.set(db, all);
  return all;
}

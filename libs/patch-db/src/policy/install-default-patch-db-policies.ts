import type { PatchesDb } from '../interface';
import { DEFAULT_PATCH_DB_VISIBILITY_POLICIES } from './default-policies';
import { VisibilityPolicyRegistry } from './visibility-policy-registry';

const uninstallByDb = new WeakMap<PatchesDb, () => void>();

/**
 * Registers default ABAC visibility policies on {@link PatchesDb.hooks}.
 * Idempotent per db instance.
 */
export function installDefaultPatchDbPolicies(db: PatchesDb): () => void {
  const existing = uninstallByDb.get(db);
  if (existing !== undefined) return existing;
  const reg = new VisibilityPolicyRegistry();
  reg.registerAll(DEFAULT_PATCH_DB_VISIBILITY_POLICIES);
  const off = reg.install(db);
  const all = () => {
    off();
    uninstallByDb.delete(db);
  };
  uninstallByDb.set(db, all);
  return all;
}

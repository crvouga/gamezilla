export {
  type CatalogValue,
  defineCatalog,
  type LimitKey,
  type PermissionKey,
  type RoleId,
} from './catalog';
export {
  type Decision,
  decide,
  decideQuota,
  grantedBy,
  type QuotaUsage,
  quotaWindowOf,
  resolveUnlockRef,
  treatmentOf,
} from './decision';
export { RoleCycleError, UnknownRoleError } from './errors';
export {
  can,
  checkLimit,
  type LimitVerdict,
  type PermissionDecision,
} from './evaluate';
export {
  type FactPredicate,
  type Facts,
  type FactValue,
  factsHash,
  matchesPredicate,
} from './facts';
export {
  type PolicyParseResult,
  parsePolicy,
} from './parse';
export {
  type DenialReason,
  definePolicy,
  type PermissionPolicy,
  type PolicyVersion,
  type PolicyVersionMeta,
  policyAt,
  policyVersionOf,
  type RestrictionSpec,
  type RoleSpec,
  type UiTreatment,
  type UnlockEntry,
} from './policy';
export {
  type QuotaGrant,
  type QuotaWindow,
  quotaWindowBounds,
  type ResetBoundary,
  type WindowBounds,
} from './quota-window';
export {
  limitsOf,
  paramsOf,
  permissionsOf,
  quotasOf,
  resolveRoleClosure,
  resolveSubject,
  restrictedOf,
} from './resolve';
export { createSubject, type Subject, withRoles } from './subject';

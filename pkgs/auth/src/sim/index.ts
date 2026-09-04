/**
 * Test / sim host seam for `@pkgs/auth`.
 * Import from `@pkgs/auth/sim` only — not for product apps/libs.
 */

export {
  dispatchOauthApprove,
  dispatchOauthStart,
  dispatchSessionExchange,
  dispatchSignOut,
  dispatchStealBearer,
  type OauthProvider,
} from './dispatch';
export { assertAuthInvariants, authFingerprint } from './invariants';
export { migrateAuthSchema, startActor, startStore } from './nodes';
export type { AuthSurface } from './system';
export {
  AUTH_ARGS,
  type AuthArgs,
  advanceClock,
  arbAuthArgs,
  auth,
  bearers,
  caps,
  clientBearers,
  clientIds,
  type FetchAuthArgs,
  fabric,
  fetchAuth,
  invariantsHold,
  invariantViolations,
  lastStatus,
  migrateSchema,
  type OauthApproveArgs,
  type OauthStartArgs,
  oauthApprove,
  oauthStart,
  sessionExchange,
  sessionUser,
  setGoogleFault,
  signOut,
  stealBearer,
  storeFingerprint,
} from './system';
export {
  type ActorState,
  AUTH_FABRICS,
  AUTH_SYSTEM_BASE_URL,
  AUTH_SYSTEM_SECRET,
  AUTH_SYSTEM_TRUSTED_ORIGINS,
  type AuthFabric,
  type AuthStore,
  requireActor,
  requireStore,
} from './types';

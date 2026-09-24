/**
 * Test / sim host seam for the in-house IdP (`@pkgs/auth-inhouse`): the auth app, a Google-flavored and
 * an Apple-flavored mock provider, devices running the production client
 * port, and a reference model every step is checked against.
 * Import from `@pkgs/auth-sim` only — not for product apps/libs.
 */

export {
  AUTH_ACTIONS,
  AUTH_FAULTS,
  advanceClock,
  appleAccountDeleted,
  appleConsentRevoked,
  appleRelayForwarding,
  clearProviderFaults,
  clientIds,
  confirmPendingLink,
  declinePendingLink,
  type FetchAuthArgs,
  fetchAuth,
  GHOST_EMAIL,
  googleEmailChanged,
  linkProvider,
  migrateSchema,
  type ProviderStepArgs,
  prepareLink,
  rotateProviderKeys,
  setOnline,
  setProviderFault,
  signIn,
  signOut,
  signOutEverywhere,
  stealBearer,
  unlinkProvider,
} from './actions';
export {
  APPLE_CLIENT_ID,
  APPLE_DIRECTORY,
  DIRECTORIES,
  GOOGLE_DIRECTORY,
} from './idp-node';
export { assertAuthInvariants, authFingerprint } from './invariants';
export { type AuthModel, identityKey } from './model';
export { migrateAuthSchema, startStore } from './nodes';
export {
  AUTH_ARGS,
  type AuthArgs,
  arbAuthArgs,
  auth,
  caps,
  clientBearers,
  fabric,
  identitiesOf,
  invariantsHold,
  invariantViolations,
  lastOutcome,
  lastStatus,
  outcomeCounts,
  sessionUser,
  signedInUser,
  storeFingerprint,
} from './system';
export {
  type ActorOutcome,
  type ActorState,
  AUTH_FABRICS,
  AUTH_SYSTEM_BASE_URL,
  AUTH_SYSTEM_SECRET,
  AUTH_SYSTEM_TRUSTED_ORIGINS,
  type AuthFabric,
  type AuthStore,
  type AuthSurface,
  type ProviderAnswers,
  requireActor,
  requireStore,
} from './types';

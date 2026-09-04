/** Framework mutation — merged by createLocalSyncEngine / createSyncApp. */
export { acknowledgeWriteRejectionMutation } from '../../../mutations/shared/acknowledge-write-rejection';
/**
 * Scripted-pin vocabulary for acme scenarios. Tests drive the run with
 * `system.script` + `s.apply` / `s.observe` — see `./system.ts` for the shape.
 */
export {
  actorId,
  addClient,
  addPeerEngine,
  armStoragePressure,
  auth,
  brokerCrash,
  brokerRestart,
  caps,
  clearLocalData,
  clearStoragePressure,
  clientIds,
  clock,
  connect,
  connection,
  converged,
  crash,
  crashAt,
  createSyncSurface,
  deviceId,
  disconnect,
  execSql,
  failNextOpen,
  foreground,
  hasSynced,
  heal,
  hold,
  httpFault,
  invariantViolations,
  lastError,
  lastMutationFailures,
  lastMutationId,
  lastMutationOk,
  liveNote,
  liveSpace,
  mutate,
  net,
  netHeld,
  nodeNow,
  nudge,
  online,
  outcome,
  partition,
  partitioned,
  pending,
  pendingEventCount,
  playActions,
  postMutations,
  postOutcome,
  publishFault,
  pubsubFault,
  pubsubRemakeCount,
  quiet,
  rejections,
  release,
  restart,
  restartWithSchema,
  revive,
  rows,
  runSql,
  SYNC_PIN_ACTIONS,
  SYNC_STEP_MS,
  schedulerQuiescent,
  serverOp,
  serverPrune,
  serverReplay,
  skewClock,
  subscribe,
  subscribeAll,
  subscribedTopics,
  syncVirtual,
  tamperLocalStorage,
  unsubscribe,
} from '../../../sim/scenario';
export { acmeApp } from './app';
export {
  expectFoldersMatchServer,
  expectLiveNote,
  expectLiveSpace,
  expectNoForeignOpenSessions,
  expectNoteNotLive,
  expectNotesMatchServer,
  expectOpenSession,
  isLiveNote,
  isLiveSpace,
  type LiveFolder,
  type LiveNote,
  type LiveOpenSession,
  type LiveSpace,
  readLiveFolders,
  readLiveNotes,
  readLiveOpenSessions,
  readNoteTombstone,
  readProfileUsername,
} from './assert';
export { acmeLocalSchema } from './client/local-schema';
export {
  checkAllClientsConverged,
  checkClientDomainMatchServer,
} from './converge';
export { acmeDomainPack } from './domain-pack';
export { expectConverged } from './expect-converged';
export { insertCatalogNote } from './insert-catalog-note';
export { createSimMembershipChannels } from './membership-channels';
export { type PlayAcmePinOpts, playAcmePin } from './play-pin';
export {
  type PoolActivation,
  poolActivate,
  poolActivateConcurrently,
  poolMatched,
  poolOverlappingCreates,
} from './pool-actions';
export {
  expectAllNotesAgree,
  expectEveryClientNotesAgree,
  expectFoldersAgree,
  expectLiveNoteAt,
  expectLiveSpaceAt,
  expectNoForeignOpenSessionsAt,
  expectNoteNotLiveAt,
  expectNotesAgree,
  expectOpenSessionAt,
  expectSpaceNotLiveAt,
  type FolderRow,
  hasLocalTable,
  hasTopic,
  isNoteLiveAt,
  isSpaceLiveAt,
  lacksTopic,
  liveFolders,
  liveNotes,
  liveOpenSessions,
  liveTags,
  localTable,
  type NoteRow,
  noteBodyIs,
  noteColor,
  noteColumns,
  noteLive,
  noteNotLive,
  type OpenSessionRow,
  profileUsername,
  readLiveNoteIds,
  readNoteTombstoneAt,
  readProfileUsernameAt,
  type TagRow,
} from './reads';
export {
  type AcmeSchemaVariant,
  acmeRestartOptsForVariant,
  acmeSchemaForVariant,
} from './schema-variants';
export { befriend } from './shared/friendship-mutations';
export {
  acmeLocalSchemaExtraColumn,
  acmeLocalSchemaExtraColumnAndTable,
  acmeLocalSchemaExtraTable,
  ghostMutation,
  notesAllV2Query,
  notesAllWithColorQuery,
  notesAuthorizeThrowQuery,
  notesByFolderQuery,
  retouchNotes,
  setNoteArgsLoose,
  setNoteArgsTight,
  setNoteColor,
  setNoteStrictExists,
  setNoteUndeclaredFolderWrite,
  setNoteUniqueSlug,
  setNoteWrongTopic,
  setTag,
  tagsAllQuery,
} from './shared/hardening-fixtures';
export {
  createSpace,
  endSpace,
  joinSpace,
  leaveSpace,
  setSpaceNote,
} from './shared/membership-mutations';
export {
  OPEN_SPACE_SESSIONS_SESSION,
  openSpaceSessionsQuery,
  SPACE_MEMBERSHIP_SESSION,
  spaceMembershipQuery,
} from './shared/membership-query';
export {
  deleteFolder,
  deleteNote,
  illegalHardDeleteNote,
  moveNote,
  requiresOnlineNote,
  serverRejectNote,
  setFolder,
  setNote,
  setNoteNoFanout,
  setNoteV2,
} from './shared/mutations';
export {
  ensureProfileEmpty,
  setProfileUsername,
} from './shared/profile-mutations';
export {
  foldersOnlyQuery,
  NOTES_AUTH_GATE_FOLDER_ID,
  notesAllQuery,
  notesDeniedQuery,
  notesLimitedQuery,
  notesOnlyQuery,
  notesOwnedQuery,
  OWN_PROFILE_SESSION,
  ownProfileQuery,
} from './shared/queries';
export {
  acmeMutationRegistry,
  acmeQueryRegistry,
} from './shared/registries';
export { ACME_APP_TABLES, acmeAppSchema } from './shared/schema';
export {
  acmeDefaultEntryChannel,
  acmeTopicMap,
} from './shared/topic-map';
export {
  NOTES_ALL_TOPIC,
  roomTopic,
  userTopic,
} from './shared/topics';
export {
  ACME_DEFAULT_ARGS,
  ACME_LARGE_CATALOG_ARGS,
  ACME_POOL_ACTIONS,
  ACME_PROPERTIES,
  acmeSystem,
  type SyncArgs,
  type SyncSurface,
} from './system';
export {
  type NeverAcmeOpts,
  neverAcme,
  type UntilAcmeOpts,
  untilAcme,
} from './until';
export { writeNoteBody } from './write-note-body';

import { runSeed, seedsFromEnv } from '../../scenario/script-seed';
import { acmeSystem } from './system';

/** Seeded fuzz entrypoint bound to the acme fixture. */
export async function runAcmeSeed(
  opts: Omit<import('../../scenario/script-seed').RunSeedOptions, 'system'>
): Promise<import('../../scenario/script-seed').RunSeedResult> {
  return runSeed({ ...opts, system: acmeSystem });
}

export { seedsFromEnv };

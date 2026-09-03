/** Framework mutation — merged by createLocalSyncEngine / createSyncApp. */
export { acknowledgeWriteRejectionMutation } from '../../../mutations/shared/acknowledge-write-rejection';
/**
 * Scripted-pin vocabulary for acme scenarios. Tests drive the run with
 * `start` + `run.apply` / `run.observe` — see `./system.ts` for the shape.
 */
export {
  actorId,
  addClient,
  addPeerEngine,
  armStoragePressure,
  assertConverged,
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
  converge,
  converged,
  crash,
  crashAt,
  defineSyncSystem,
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
  passTime,
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
  rows,
  runSql,
  SYNC_PIN_ACTIONS,
  SYNC_PROPERTIES,
  SYNC_STEP_MS,
  schedulerQuiescent,
  serverOp,
  serverPrune,
  serverReplay,
  settle,
  skewClock,
  subscribe,
  subscribeAll,
  subscribedTopics,
  syncVirtualHost,
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
  acmeDraws,
  acmeLargeCatalogSystem,
  acmeSystem,
  type SyncSurface,
} from './system';
export {
  type NeverAcmeOpts,
  neverAcme,
  type UntilAcmeOpts,
  untilAcme,
} from './until';
export { writeNoteBody } from './write-note-body';

import { runSeed, seedsFromEnv } from '../../scenario/run-seed';
import { acmeApp } from './app';

/** Seeded fuzz entrypoint bound to the acme fixture. */
export async function runAcmeSeed(
  opts: Omit<import('../../scenario/run-seed').RunSeedOptions, 'app'>
): Promise<import('../../scenario/run-seed').RunSeedResult> {
  return runSeed({ ...opts, app: acmeApp });
}

export { seedsFromEnv };

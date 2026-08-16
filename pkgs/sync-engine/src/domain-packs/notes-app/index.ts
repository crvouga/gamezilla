/** Framework mutation — merged by createLocalSyncEngine / createSyncApp. */
export { acknowledgeWriteRejectionMutation } from '../../mutations/shared/acknowledge-write-rejection';
export {
  expectFoldersMatchServer,
  expectLiveNote,
  expectNoForeignOpenSessions,
  expectNoteNotLive,
  expectNotesMatchServer,
  expectOpenSession,
  isLiveNote,
  type LiveFolder,
  type LiveNote,
  type LiveOpenSession,
  readLiveFolders,
  readLiveNotes,
  readLiveOpenSessions,
  readNoteTombstone,
  readProfileUsername,
} from './assert';
export { notesLocalSchema } from './client/local-schema';
export {
  checkAllClientsConverged,
  checkClientDomainMatchServer,
} from './converge';
export { notesDomainPack } from './domain-pack';
export { createSimMembershipChannels } from './membership-channels';
export { runNotesSeed, runSeed, seedsFromEnv } from './replay';
export {
  ghostMutation,
  notesAuthorizeThrowQuery,
  notesByFolderQuery,
  notesLocalSchemaExtraColumn,
  notesLocalSchemaExtraTable,
  notesWorldV2Query,
  notesWorldWithColorQuery,
  retouchNotes,
  setNoteArgsLoose,
  setNoteArgsTight,
  setNoteColor,
  setNoteStrictExists,
  setNoteUndeclaredFolderWrite,
  setNoteUniqueSlug,
  setNoteWrongTopic,
  setTag,
  tagsWorldQuery,
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
  notesDeniedQuery,
  notesLimitedQuery,
  notesOnlyQuery,
  notesOwnedQuery,
  notesWorldQuery,
  OWN_PROFILE_SESSION,
  ownProfileQuery,
} from './shared/queries';
export {
  notesMutationRegistry,
  notesQueryRegistry,
} from './shared/registries';
export { NOTES_APP_TABLES, notesAppSchema } from './shared/schema';
export {
  notesDefaultEntryChannel,
  notesTopicMap,
} from './shared/topic-map';
export {
  NOTES_WORLD_TOPIC,
  roomTopic,
  userTopic,
} from './shared/topics';
export { insertCatalogNote } from './insert-catalog-note';
export { writeNoteBody } from './write-note-body';

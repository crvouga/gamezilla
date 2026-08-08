/** Framework mutation — available via notes registry (`withFrameworkMutations`). */
export { acknowledgeWriteRejectionMutation } from '../../mutations/shared/acknowledge-write-rejection';
export {
  expectFoldersMatchServer,
  expectLiveNote,
  expectNoteNotLive,
  expectNotesMatchServer,
  type LiveFolder,
  type LiveNote,
  readLiveFolders,
  readLiveNotes,
  readNoteTombstone,
} from './assert';
export { notesLocalSchema } from './client/local-schema';
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
  foldersOnlyQuery,
  NOTES_AUTH_GATE_FOLDER_ID,
  notesDeniedQuery,
  notesLimitedQuery,
  notesOnlyQuery,
  notesOwnedQuery,
  notesWorldQuery,
} from './shared/queries';
export {
  notesMutationRegistry,
  notesQueryRegistry,
} from './shared/registries';
export { NOTES_APP_TABLES, notesAppSchema } from './shared/schema';
export {
  NOTES_WORLD_TOPIC,
  roomTopic,
  spaceMembershipChannels,
  userTopic,
} from './shared/topics';

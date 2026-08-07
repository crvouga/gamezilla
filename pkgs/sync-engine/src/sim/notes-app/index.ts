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
  deleteFolder,
  deleteNote,
  illegalHardDeleteNote,
  moveNote,
  setFolder,
  setNote,
} from './shared/mutations';
export { notesWorldQuery } from './shared/queries';
export {
  notesMutationRegistry,
  notesQueryRegistry,
} from './shared/registries';
export { NOTES_APP_TABLES, notesAppSchema } from './shared/schema';
export { NOTES_WORLD_TOPIC } from './shared/topics';

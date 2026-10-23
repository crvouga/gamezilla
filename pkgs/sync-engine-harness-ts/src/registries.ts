import { mutationRegistry } from '@pkgs/sync-engine-shared-ts/mutations-registry';
import { queryRegistry } from '@pkgs/sync-engine-shared-ts/queries-registry';
import { befriend } from './friendship-mutations';
import {
  notesAllV2Query,
  notesAuthorizeThrowQuery,
  notesByFolderQuery,
  retouchNotes,
  setNoteArgsTight,
  setNoteStrictExists,
  setNoteUndeclaredFolderWrite,
  setNoteUniqueSlug,
  setNoteWrongTopic,
} from './hardening-fixtures';
import {
  createSpace,
  endSpace,
  joinSpace,
  leaveSpace,
  setSpaceNote,
} from './membership-mutations';
import {
  openSpaceSessionsQuery,
  spaceMembershipQuery,
} from './membership-query';
import {
  deleteFolder,
  deleteNote,
  illegalHardDeleteNote,
  moveNote,
  pendingNote,
  requiresOnlineNote,
  serverRejectNote,
  setFolder,
  setNote,
  setNoteNoFanout,
  setNoteV2,
} from './mutations';
import { ensureProfileEmpty, setProfileUsername } from './profile-mutations';
import {
  foldersOnlyQuery,
  notesAllQuery,
  notesDeniedQuery,
  notesLargeAllQuery,
  notesLimitedQuery,
  notesOnlyQuery,
  notesOwnedQuery,
  ownProfileQuery,
} from './queries';

/** Product-only registry; createLocalSyncEngine / createSyncApp merge framework mutations. */
export const exampleMutationRegistry = mutationRegistry([
  setFolder,
  deleteFolder,
  setNote,
  setNoteV2,
  setNoteNoFanout,
  deleteNote,
  moveNote,
  illegalHardDeleteNote,
  serverRejectNote,
  requiresOnlineNote,
  pendingNote,
  createSpace,
  joinSpace,
  leaveSpace,
  endSpace,
  setSpaceNote,
  befriend,
  setProfileUsername,
  ensureProfileEmpty,
  setNoteArgsTight,
  setNoteUniqueSlug,
  setNoteUndeclaredFolderWrite,
  setNoteWrongTopic,
  setNoteStrictExists,
  retouchNotes,
]);

export const exampleQueryRegistry = queryRegistry([
  notesAllQuery,
  notesLargeAllQuery,
  notesAllV2Query,
  notesByFolderQuery,
  notesAuthorizeThrowQuery,
  notesDeniedQuery,
  notesLimitedQuery,
  notesOwnedQuery,
  notesOnlyQuery,
  foldersOnlyQuery,
  ownProfileQuery,
  spaceMembershipQuery,
  openSpaceSessionsQuery,
]);

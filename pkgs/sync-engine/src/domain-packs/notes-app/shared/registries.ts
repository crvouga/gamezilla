import { mutationRegistry, queryRegistry } from '@pkgs/sync-engine/shared';
import { befriend } from './friendship-mutations';
import {
  notesAuthorizeThrowQuery,
  notesByFolderQuery,
  notesWorldV2Query,
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
  notesDeniedQuery,
  notesLimitedQuery,
  notesOnlyQuery,
  notesOwnedQuery,
  notesWorldQuery,
  ownProfileQuery,
} from './queries';

/** Product-only registry; createLocalSyncEngine / createSyncApp merge framework mutations. */
export const notesMutationRegistry = mutationRegistry([
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

export const notesQueryRegistry = queryRegistry([
  notesWorldQuery,
  notesWorldV2Query,
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

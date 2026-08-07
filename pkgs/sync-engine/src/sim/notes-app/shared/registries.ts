import {
  mutationRegistry,
  queryRegistry,
  withFrameworkMutations,
} from '@pkgs/sync-engine/shared';

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
import {
  foldersOnlyQuery,
  notesDeniedQuery,
  notesLimitedQuery,
  notesOnlyQuery,
  notesOwnedQuery,
  notesWorldQuery,
} from './queries';

export const notesMutationRegistry = withFrameworkMutations(
  mutationRegistry([
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
  ])
);

export const notesQueryRegistry = queryRegistry([
  notesWorldQuery,
  notesDeniedQuery,
  notesLimitedQuery,
  notesOwnedQuery,
  notesOnlyQuery,
  foldersOnlyQuery,
]);

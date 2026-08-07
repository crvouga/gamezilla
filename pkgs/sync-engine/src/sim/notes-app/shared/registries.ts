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
} from './mutations';
import { notesDeniedQuery, notesWorldQuery } from './queries';

export const notesMutationRegistry = withFrameworkMutations(
  mutationRegistry([
    setFolder,
    deleteFolder,
    setNote,
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
]);

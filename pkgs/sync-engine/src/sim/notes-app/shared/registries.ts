import { mutationRegistry, queryRegistry } from '@pkgs/sync-engine/shared';

import {
  deleteFolder,
  deleteNote,
  illegalHardDeleteNote,
  moveNote,
  setFolder,
  setNote,
} from './mutations';
import { notesWorldQuery } from './queries';

export const notesMutationRegistry = mutationRegistry([
  setFolder,
  deleteFolder,
  setNote,
  deleteNote,
  moveNote,
  illegalHardDeleteNote,
]);

export const notesQueryRegistry = queryRegistry([notesWorldQuery]);

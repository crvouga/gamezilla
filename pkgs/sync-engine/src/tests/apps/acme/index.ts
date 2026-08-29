/** Framework mutation — merged by createLocalSyncEngine / createSyncApp. */
export { acknowledgeWriteRejectionMutation } from '../../../mutations/shared/acknowledge-write-rejection';
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
export { acmeDstApp } from './dst-app';
export { insertCatalogNote } from './insert-catalog-note';
export { createSimMembershipChannels } from './membership-channels';
export { befriend } from './shared/friendship-mutations';
export {
  acmeLocalSchemaExtraColumn,
  acmeLocalSchemaExtraColumnAndTable,
  acmeLocalSchemaExtraTable,
  ghostMutation,
  notesAuthorizeThrowQuery,
  notesByFolderQuery,
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
  acmeRestartOptsForVariant,
  acmeSchemaForVariant,
  type AcmeSchemaVariant,
} from './schema-variants';
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
  acmeMutationRegistry,
  acmeQueryRegistry,
} from './shared/registries';
export { ACME_APP_TABLES, acmeAppSchema } from './shared/schema';
export {
  acmeDefaultEntryChannel,
  acmeTopicMap,
} from './shared/topic-map';
export {
  NOTES_WORLD_TOPIC,
  roomTopic,
  userTopic,
} from './shared/topics';
export { writeNoteBody } from './write-note-body';

import { runDstSeed, seedsFromEnv } from '../../dst/run-seed';
import { acmeDstApp } from './dst-app';

/** Seeded fuzz entrypoint bound to the acme fixture. */
export async function runAcmeSeed(
  opts: Omit<import('../../dst/run-seed').RunSeedOptions, 'app'>
): Promise<import('../../dst/run-seed').RunSeedResult> {
  return runDstSeed({ ...opts, app: acmeDstApp });
}

export { seedsFromEnv };

/** @deprecated Alias for {@link runAcmeSeed}. */
export const runSeed = runAcmeSeed;

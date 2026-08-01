/**
 * Upload authorization context for the rules + table-policy pipeline.
 * Auth mapping from session/JWT stays in apps/api; sync-engine only
 * consumes this normalized shape.
 */
export type UploadAuth = {
  readonly subjectId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  readonly myId: string;
  readonly isAnonymous: boolean;
  readonly memberOfSpaceIds: readonly string[];
};

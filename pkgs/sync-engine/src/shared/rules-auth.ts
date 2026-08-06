/**
 * Upload authorization context for the table-policy pipeline (and the
 * combined upload txn). Auth mapping from session/JWT stays in apps/api;
 * sync-engine only consumes this normalized shape.
 *
 * Distinct from `@pkgs/rules` {@link RulesAuth}: policies may need
 * membership lists that assertive rules do not.
 */
export type UploadAuth = {
  readonly userId: string;
  readonly deviceId: string;
  readonly accountId: string | null;
  /** True when the caller is an anon `users` row (not provider-linked). */
  readonly isAnon: boolean;
  readonly memberOfSpaceIds: readonly string[];
};

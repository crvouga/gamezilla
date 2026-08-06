/**
 * App identity used by legacy-named auth hooks while callers migrate to
 * mutation clients.
 */
export type AppRulesAuth = {
  readonly userId: string;
  /** `users.id` when resolved; null only before anon ensure. */
  readonly accountId: string | null;
  readonly deviceId: string;
  /** True when the current user row is anon (no provider link). */
  readonly isAnon: boolean;
};

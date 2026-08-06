import type { RulesAuth } from '@pkgs/rules/core/types';

/**
 * App-level auth passed into domain rules / validatedWrite.
 * Extends the engine's agnostic {@link RulesAuth} with identity fields
 * product rules need (account, device, anon flag).
 */
export type AppRulesAuth = RulesAuth & {
  /** `users.id` when resolved; null only before anon ensure. */
  readonly accountId: string | null;
  readonly deviceId: string;
  /** True when the current user row is anon (no provider link). */
  readonly isAnon: boolean;
};

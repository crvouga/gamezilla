import type { RulesAuth } from '@pkgs/rules/core/types';

/**
 * App-level auth passed into domain rules / validatedWrite.
 * Extends the engine's agnostic {@link RulesAuth} with identity fields
 * product rules need (signed-in account, device).
 */
export type AppRulesAuth = RulesAuth & {
  readonly accountId: string | null;
  readonly deviceId: string;
};

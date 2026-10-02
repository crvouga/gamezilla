import type { MutationCtx, MutationAuthorize } from '@pkgs/sync-engine/shared';

/** Each context owns the personal rows it exports, withdraws and erases. */
export type AccountPrivacyContribution = {
  readonly name: string;
  readonly snapshot: (ctx: MutationCtx) => Promise<unknown>;
  readonly withdraw: (ctx: MutationCtx) => Promise<void>;
  readonly erase: (ctx: MutationCtx) => Promise<void>;
};

export type AccountPrivacyGuard = (
  contributions: readonly AccountPrivacyContribution[]
) => MutationAuthorize;

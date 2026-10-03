import { createMessageNamespace, isPlainRecord } from '@pkgs/message';
import type { RoomServicePort } from '@pkgs/room/server';
import type { MutationAuthorize, MutationCtx } from '@pkgs/sync-engine/shared';

export type AccountWithdrawal = { readonly accountId: string };
export const accountWithdrawalChanged = createMessageNamespace(
  'account',
  'privacy'
)(
  'withdrawal-changed',
  (value): value is AccountWithdrawal =>
    isPlainRecord(value) && typeof value['accountId'] === 'string'
);

/** Each context owns the personal rows it exports, withdraws and erases. */
export type AccountPrivacyContribution = {
  readonly name: string;
  readonly snapshot: (
    ctx: MutationCtx,
    rooms: RoomServicePort
  ) => Promise<unknown>;
  readonly withdraw: (ctx: MutationCtx) => Promise<void>;
  readonly erase: (ctx: MutationCtx, rooms: RoomServicePort) => Promise<void>;
  readonly withdrawalStatus?: (
    ctx: MutationCtx
  ) => Promise<'pending' | 'complete'>;
};

export type AccountPrivacyGuard = (
  contributions: readonly AccountPrivacyContribution[]
) => MutationAuthorize;

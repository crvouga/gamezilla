import { accountMutationEnv } from '@libs/auth/public/account-mutation-env';
import {
  type AccountPrivacyContribution,
  accountWithdrawalChanged,
} from '@libs/feature/public/account-privacy';
import {
  Outbox,
  type OutboxConsumerCtx,
  type OutboxConsumerRegistry,
} from '@pkgs/outbox';
import { sql } from '@pkgs/sql';
import type { MutationCtx } from '@pkgs/sync-engine/shared';
import type { RoomServicePort } from '@pkgs/room/server';
import {
  eraseAccount,
  expireExport,
  prepareExport,
  withdrawAccount,
} from '../../shared/privacy/messages';

function accountContext(
  ctx: OutboxConsumerCtx,
  accountId: string
): MutationCtx {
  return {
    tx: ctx.tx,
    env: accountMutationEnv(accountId, ctx),
  };
}

async function updateWithdrawalStatus(
  ctx: OutboxConsumerCtx,
  accountId: string,
  contributions: readonly AccountPrivacyContribution[]
) {
  const context = accountContext(ctx, accountId);
  const states = await Promise.all(
    contributions.map(
      (contribution) => contribution.withdrawalStatus?.(context) ?? 'complete'
    )
  );
  const status = states.includes('pending') ? 'pending' : 'complete';
  await ctx.tx.run(
    sql`UPDATE profile_account_privacy SET cancellation_status = ${status} WHERE owner_id = ${accountId}`
  );
  await ctx.tx.run(
    sql`UPDATE profile_deletion_receipts SET cancellation_status = ${status} WHERE owner_id = ${accountId}`
  );
  return { notifyUserIds: [accountId] };
}

async function generateExport(
  ctx: OutboxConsumerCtx,
  accountId: string,
  contributions: readonly AccountPrivacyContribution[],
  rooms: RoomServicePort
): Promise<void> {
  const state = await ctx.tx.query(
    sql<{
      deletion_at: string | null;
      export_status: string;
    }>`SELECT deletion_at, export_status FROM profile_account_privacy WHERE owner_id = ${accountId}`
  );
  if (state[0]?.deletion_at != null || state[0]?.export_status !== 'Preparing')
    return;
  try {
    const categories: Record<string, unknown> = {};
    for (const contribution of contributions)
      categories[contribution.name] = await contribution.snapshot(
        accountContext(ctx, accountId),
        rooms
      );
    const detail = JSON.stringify({ accountId, categories }, null, 2);
    if (ctx.objectStore === undefined)
      throw new Error('Export storage port missing');
    await ctx.objectStore.put(
      `privacy/exports/${accountId}.json`,
      new TextEncoder().encode(detail),
      'application/json'
    );
    const summary = `Personal data for your account\nPrepared ${new Date(ctx.clock.now()).toISOString()}\n\n${Object.entries(
      categories
    )
      .map(([name, value]) => `${name}\n${JSON.stringify(value, null, 2)}`)
      .join('\n\n')}`;
    await ctx.tx.run(
      sql`UPDATE profile_account_privacy SET export_status = ${'Ready'}, ready_at = ${new Date(ctx.clock.now()).toISOString()}, export_detail = ${detail}, export_summary = ${summary} WHERE owner_id = ${accountId} AND deletion_at IS NULL`
    );
    const eventId = ctx.createId();
    await new Outbox(accountContext(ctx, accountId)).send({
      id: eventId,
      message: expireExport({ accountId }),
    });
    await ctx.tx.run(
      sql`UPDATE outbox_events SET available_at = ${new Date(ctx.clock.now() + 7 * 86_400_000).toISOString()} WHERE id = ${eventId}`
    );
  } catch {
    await ctx.tx.run(
      sql`UPDATE profile_account_privacy SET export_status = ${'ExportFailed'}, export_detail = ${null}, export_summary = ${null} WHERE owner_id = ${accountId} AND deletion_at IS NULL`
    );
  }
}

export function registerPrivacyConsumers(
  registry: OutboxConsumerRegistry,
  contributions: readonly AccountPrivacyContribution[],
  rooms: RoomServicePort,
  exportPreparation: 'automatic' | 'on-demand' = 'automatic'
): void {
  registry.register({
    id: 'profile-withdrawal-status',
    on: accountWithdrawalChanged,
    handler: (ctx, payload) =>
      updateWithdrawalStatus(ctx, payload.accountId, contributions),
  });
  registry.register({
    id: 'profile-expire-export',
    on: expireExport,
    handler: async (ctx, payload) => {
      const cutoff = new Date(ctx.clock.now() - 7 * 86_400_000).toISOString();
      const rows = await ctx.tx.query(
        sql<{
          ready_at: string | null;
        }>`SELECT ready_at FROM profile_account_privacy WHERE owner_id = ${payload.accountId}`
      );
      if (
        rows[0]?.ready_at == null ||
        Date.parse(String(rows[0].ready_at)) > Date.parse(cutoff)
      )
        return;
      if (ctx.objectStore === undefined)
        throw new Error('Privacy storage port missing');
      await ctx.objectStore.delete(`privacy/exports/${payload.accountId}.json`);
      await ctx.tx.run(
        sql`UPDATE profile_account_privacy SET export_status = ${'Expired'}, export_detail = ${null}, export_summary = ${null} WHERE owner_id = ${payload.accountId}`
      );
      return { notifyUserIds: [payload.accountId] };
    },
  });
  if (exportPreparation === 'automatic')
    registry.register(exportPreparationConsumer(contributions, rooms));
  registry.register({
    id: 'profile-erase-account',
    on: eraseAccount,
    handler: async (ctx, payload) => {
      for (const contribution of contributions)
        await contribution.erase(accountContext(ctx, payload.accountId), rooms);
      await ctx.tx.run(
        sql`UPDATE profile_account_privacy SET erased_at = ${new Date(ctx.clock.now()).toISOString()}, export_detail = ${null}, export_summary = ${null} WHERE owner_id = ${payload.accountId}`
      );
    },
  });
  registry.register({
    id: 'profile-withdraw-account',
    on: withdrawAccount,
    handler: async (ctx, payload) => {
      if (ctx.objectStore === undefined)
        throw new Error('Privacy storage port missing');
      await ctx.objectStore.delete(`privacy/exports/${payload.accountId}.json`);
      return updateWithdrawalStatus(ctx, payload.accountId, contributions);
    },
  });
}

export function exportPreparationConsumer(
  contributions: readonly AccountPrivacyContribution[],
  rooms: RoomServicePort
) {
  return {
    id: 'profile-prepare-export',
    on: prepareExport,
    handler: async (
      ctx: OutboxConsumerCtx,
      payload: { readonly accountId: string }
    ) => {
      await generateExport(ctx, payload.accountId, contributions, rooms);
      return { notifyUserIds: [payload.accountId] };
    },
  };
}

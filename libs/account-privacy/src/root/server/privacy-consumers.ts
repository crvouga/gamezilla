import type { AccountPrivacyContribution } from '@libs/feature/public/account-privacy';
import {
  Outbox,
  type OutboxConsumerRegistry,
  type OutboxConsumerCtx,
} from '@pkgs/outbox';
import { sql } from '@pkgs/sql';
import type { MutationCtx } from '@pkgs/sync-engine/shared';
import {
  eraseAccount,
  prepareExport,
  withdrawAccount,
  expireExport,
} from '../../shared/privacy/messages';

function accountContext(
  ctx: OutboxConsumerCtx,
  accountId: string
): MutationCtx {
  return {
    tx: ctx.tx,
    env: {
      actorId: accountId,
      accountId,
      deviceId: '',
      isAnon: false,
      now: () => new Date(ctx.clock.now()),
      createId: ctx.createId,
    },
  };
}

async function generateExport(
  ctx: OutboxConsumerCtx,
  accountId: string,
  contributions: readonly AccountPrivacyContribution[]
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
        accountContext(ctx, accountId)
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
  contributions: readonly AccountPrivacyContribution[]
): void {
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
      if (rows[0]?.ready_at == null || String(rows[0].ready_at) > cutoff)
        return;
      await ctx.objectStore?.delete(
        `privacy/exports/${payload.accountId}.json`
      );
      await ctx.tx.run(
        sql`UPDATE profile_account_privacy SET export_status = ${'Expired'}, export_detail = ${null}, export_summary = ${null} WHERE owner_id = ${payload.accountId}`
      );
      return { notifyUserIds: [payload.accountId] };
    },
  });
  registry.register({
    id: 'profile-prepare-export',
    on: prepareExport,
    handler: async (ctx, payload) => {
      await generateExport(ctx, payload.accountId, contributions);
      return { notifyUserIds: [payload.accountId] };
    },
  });
  registry.register({
    id: 'profile-erase-account',
    on: eraseAccount,
    handler: async (ctx, payload) => {
      for (const contribution of contributions)
        await contribution.erase(accountContext(ctx, payload.accountId));
      await ctx.tx.run(
        sql`UPDATE profile_account_privacy SET erased_at = ${new Date(ctx.clock.now()).toISOString()}, export_detail = ${null}, export_summary = ${null} WHERE owner_id = ${payload.accountId}`
      );
    },
  });
  registry.register({
    id: 'profile-withdraw-account',
    on: withdrawAccount,
    handler: async (ctx, payload) => {
      await ctx.objectStore?.delete(
        `privacy/exports/${payload.accountId}.json`
      );
      await ctx.tx.run(
        sql`UPDATE profile_account_privacy SET cancellation_status = ${'complete'} WHERE owner_id = ${payload.accountId} AND cancellation_status <> ${'waiting_for_provider'}`
      );
    },
  });
}

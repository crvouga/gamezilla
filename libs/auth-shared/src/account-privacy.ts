import type { AccountPrivacyContribution } from '@libs/feature-shared/account-privacy';
import { createMessageNamespace, isPlainRecord } from '@pkgs/message-shared/message';
import { Outbox } from '@pkgs/outbox-shared/outbox';
import sql from '@pkgs/sql-shared/sql';

export type DeletedIdentity = { readonly externalId: string };
export const deletedIdentity = createMessageNamespace('auth')(
  'deleted-identity',
  (p): p is DeletedIdentity =>
    isPlainRecord(p) && typeof p['externalId'] === 'string'
);

export const AUTH_PRIVACY: AccountPrivacyContribution = {
  name: 'account and devices',
  snapshot: async ({ tx, env }) => ({
    identities: await tx.query(
      sql<
        Record<string, unknown>
      >`SELECT provider, metadata, created_at FROM auth_external_accounts WHERE user_id = ${env.actorId} AND deleted_at IS NULL`
    ),
    devices: await tx.query(
      sql<
        Record<string, unknown>
      >`SELECT platform, os_name, os_version, device_model_name, device_brand, device_name, app_version, first_seen_at, last_seen_at FROM auth_devices WHERE user_id = ${env.actorId} AND deleted_at IS NULL`
    ),
  }),
  withdraw: async (ctx) => {
    const now = (ctx.env.serverNow ?? ctx.env.now)().toISOString();
    const identities = await ctx.tx.query<{ external_id: string }>(
      sql`SELECT external_id FROM auth_external_accounts WHERE user_id = ${ctx.env.actorId} AND provider = ${'idp'} AND deleted_at IS NULL`
    );
    for (const identity of identities)
      await new Outbox(ctx).send({
        id: ctx.env.createId(),
        message: deletedIdentity({ externalId: identity.external_id }),
      });
    await ctx.tx.run(
      sql`UPDATE auth_users SET deleted_at = ${now} WHERE id = ${ctx.env.actorId}`
    );
    await ctx.tx.run(
      sql`UPDATE auth_account_devices SET deleted_at = ${now} WHERE user_id = ${ctx.env.actorId}`
    );
    await ctx.tx.run(
      sql`UPDATE auth_devices SET deleted_at = ${now} WHERE user_id = ${ctx.env.actorId}`
    );
    await ctx.tx.run(
      sql`UPDATE auth_external_accounts SET deleted_at = ${now} WHERE user_id = ${ctx.env.actorId}`
    );
  },
  erase: async ({ tx, env }) => {
    await tx.run(
      sql`UPDATE auth_external_accounts SET external_id = ${null}, metadata = ${null} WHERE user_id = ${env.actorId}`
    );
    await tx.run(
      sql`UPDATE auth_devices SET user_id = ${null}, account_id = ${null}, user_agent = ${null}, device_name = ${null}, device_model_name = ${null}, device_brand = ${null}, os_name = ${null}, os_version = ${null}, platform = ${null}, app_version = ${null}, app_build_number = ${null} WHERE user_id = ${env.actorId}`
    );
  },
};

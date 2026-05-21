import { ACCOUNT_ENTITY_TYPE, AccountAttr } from '@libs/auth/shared';
import type { PatchDb } from '@pkgs/patch-db/interface';

/**
 * Resolves `account/id` for the row whose `account/stripeCustomerId` matches Stripe `cus_…`.
 */
export async function resolveAccountIdByStripeCustomerId(
  db: PatchDb,
  stripeCustomerId: string,
  ctx: Readonly<Record<string, unknown>>
): Promise<string | null> {
  const [row] = await db.read(
    [
      {
        entityType: ACCOUNT_ENTITY_TYPE,
        where: {
          type: '=',
          attribute: AccountAttr.stripeCustomerId.key,
          value: stripeCustomerId,
        },
        limit: 1,
      },
    ],
    ctx
  );
  const ent = row?.entities[0];
  const id = ent?.attributes[AccountAttr.id.key];
  return typeof id === 'string' ? id : null;
}

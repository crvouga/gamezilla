import { ACCOUNT_ENTITY_TYPE, AccountAttr } from '@gamezilla/domain/auth';
import type {
  PatchDb,
  PatchDbSystemContext,
} from '@gamezilla/patch-db/interface';

/**
 * Resolves `account/id` for the row whose `account/stripeCustomerId` matches Stripe `cus_…`.
 */
export async function resolveAccountIdByStripeCustomerId(
  db: PatchDb,
  stripeCustomerId: string,
  ctx: PatchDbSystemContext
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

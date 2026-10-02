import type { ProductHarness } from '@libs/harness/system/harness';
import {
  customerAt,
  membershipProviderOf,
  providerSubscriptions,
} from './billing-provider-driver';

/** Payment facts read from the provider, independent of subscription status. */
export async function paymentFacts(
  s: ProductHarness,
  accountId: string
): Promise<{
  readonly credit: number;
  readonly cardDeclines: boolean;
}> {
  const provider = await membershipProviderOf(s, accountId);
  const customerId = await customerAt(s, accountId, provider);
  if (customerId === null) return { credit: 0, cardDeclines: false };
  const customer = await provider.stripe.customers.retrieve(customerId);
  if (customer.deleted)
    throw new Error('Membership refers to a deleted customer');
  const [subscription] = await providerSubscriptions(customerId, provider);
  const method =
    subscription?.default_payment_method ??
    customer.invoice_settings.default_payment_method;
  const paymentMethod =
    typeof method === 'string'
      ? await provider.stripe.paymentMethods.retrieve(method)
      : method;
  // The failing test card used by the lifecycle stimulus ends in 0341.
  return {
    credit: Math.max(0, -customer.balance),
    cardDeclines: paymentMethod?.card?.last4 === '0341',
  };
}

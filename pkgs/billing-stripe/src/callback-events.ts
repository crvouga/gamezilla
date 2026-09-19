/**
 * The Stripe subscription events whose state we project. Vendor event names
 * live only here; `@libs/billing` never sees them.
 */
export const STRIPE_MEMBERSHIP_CALLBACK_EVENTS: Readonly<Record<string, true>> =
  {
    'customer.subscription.created': true,
    'customer.subscription.updated': true,
    'customer.subscription.deleted': true,
    'customer.subscription.paused': true,
    'customer.subscription.resumed': true,
  };

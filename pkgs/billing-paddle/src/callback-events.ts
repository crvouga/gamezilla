/**
 * The Paddle subscription events whose state we project. Vendor event names
 * live only here; `@libs/billing` never sees them.
 */
export const PADDLE_MEMBERSHIP_CALLBACK_EVENTS: Readonly<Record<string, true>> =
  {
    'subscription.created': true,
    'subscription.imported': true,
    'subscription.updated': true,
    'subscription.activated': true,
    'subscription.trialing': true,
    'subscription.past_due': true,
    'subscription.paused': true,
    'subscription.resumed': true,
    'subscription.canceled': true,
  };

/** The event after which a subscription is final, whatever a re-read says. */
export const PADDLE_SUBSCRIPTION_ENDED_EVENT = 'subscription.canceled';

export const PADDLE_PAYMENT_CALLBACK_EVENT = 'transaction.completed';

export const PADDLE_CALLBACK_EVENTS = [
  ...Object.keys(PADDLE_MEMBERSHIP_CALLBACK_EVENTS),
  PADDLE_PAYMENT_CALLBACK_EVENT,
];

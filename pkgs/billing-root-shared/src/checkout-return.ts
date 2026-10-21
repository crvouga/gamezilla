/**
 * How a person who paid at checkout comes back marked as having paid.
 *
 * Checkout leaves for the provider's hosted page, so whatever the app knew
 * before is gone when the person returns. Paying and leaving return to the
 * same screen; only the paid return carries this mark, so the screen can say
 * the payment is being confirmed — instead of offering a second checkout —
 * until the provider's news about the new membership arrives.
 *
 * A provider that sets its success address per checkout sends the paid
 * return to {@link paidCheckoutReturnUrl}; one whose success address is
 * configured at the provider is configured with that address.
 */

/** The query parameter the paid return carries, and its value. */
export const CHECKOUT_RETURN_PARAM = 'checkout';
export const CHECKOUT_RETURN_PAID = 'paid';

/** `returnUrl`, marked as the return of a person who paid. */
export function paidCheckoutReturnUrl(returnUrl: string): string {
  const url = new URL(returnUrl);
  url.searchParams.set(CHECKOUT_RETURN_PARAM, CHECKOUT_RETURN_PAID);
  return url.toString();
}

/** Whether a return address's query value says the person paid. */
export function isPaidCheckoutReturn(value: string | undefined): boolean {
  return value === CHECKOUT_RETURN_PAID;
}

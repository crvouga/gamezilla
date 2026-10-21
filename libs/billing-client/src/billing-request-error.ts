/**
 * Why opening checkout or the billing portal failed, in the terms the screen
 * explains it in. Read from the answer's status alone, so it holds whatever
 * the body says.
 */

export type BillingRequestFailure =
  /** The account already has a membership (checkout answers 409). */
  | 'has_membership'
  /** The payment provider could not be reached or answered nothing (5xx). */
  | 'provider_unavailable'
  /** Anything else: a refusal or an answer the app does not understand. */
  | 'failed';

export class BillingRequestError extends Error {
  constructor(
    readonly failure: BillingRequestFailure,
    message: string
  ) {
    super(message);
    this.name = 'BillingRequestError';
  }
}

export function billingFailureOf(status: number): BillingRequestFailure {
  if (status === 409) return 'has_membership';
  if (status >= 500 && status <= 599) return 'provider_unavailable';
  return 'failed';
}

/** The failure behind `error`, or `null` when it is not a billing request's. */
export function billingFailureIn(error: unknown): BillingRequestFailure | null {
  return error instanceof BillingRequestError ? error.failure : null;
}

/**
 * The provider page `res` sends the person to; throws a
 * {@link BillingRequestError} for any other answer.
 */
export async function providerUrlFrom(
  res: Response,
  what: 'checkout' | 'portal'
): Promise<string> {
  if (!res.ok) {
    throw new BillingRequestError(
      billingFailureOf(res.status),
      `billing ${what} failed (${String(res.status)})`
    );
  }
  const body = (await res.json()) as { url?: unknown };
  if (typeof body.url !== 'string' || body.url.length === 0) {
    throw new BillingRequestError('failed', `billing ${what} returned no url`);
  }
  return body.url;
}

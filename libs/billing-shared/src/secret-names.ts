/**
 * Secret names the billing sub reads by name.
 *
 * `API_URL` is the same key the API Worker binding uses; the billing scripts
 * need it to compose the absolute webhook URL the provider must POST to.
 */
export const BILLING_API_ORIGIN_SECRET = 'API_URL' as const;

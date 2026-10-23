/** Secret names used by the Paddle billing adapter (same keys in `dev` and `prd`). */
export const PaddleSecretKeys = {
  /** Server-side API key (`pdl_live_apikey_…` / `pdl_sdbx_apikey_…`). */
  apiKey: 'PADDLE_API_KEY',
  /** The notification destination's endpoint secret (`pdl_ntfset_…`). */
  webhookSecret: 'PADDLE_WEBHOOK_SECRET',
  /**
   * A Paddle hosted checkout link (`https://pay.paddle.io/hsc_…`). Without it
   * checkout sends people to the account's default payment link.
   */
  checkoutUrl: 'PADDLE_CHECKOUT_URL',
} as const;

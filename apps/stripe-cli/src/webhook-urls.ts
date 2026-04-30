function trimTrailingSlashes(url: string): string {
  return url.trim().replace(/\/+$/, '');
}

export function healthCheckUrl(apiBase: string): string {
  return `${trimTrailingSlashes(apiBase)}/health`;
}

/** Full URL for Stripe `listen --forward-to` and for signed POST probes. */
export function stripeWebhookUrl(apiBase: string): string {
  return `${trimTrailingSlashes(apiBase)}/stripe/webhook`;
}

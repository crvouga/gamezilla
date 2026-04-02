/** Domains backed by this stack (must match deployment-pipeline post-deploy). */
export const SETUP_DNS_DOMAINS = [
  { domain: 'gamezilla.app', outputKey: 'Route53Nameservers' },
] as const;

export const CUSTOM_HTTPS_HOSTS = [
  'https://www.gamezilla.app',
] as const;

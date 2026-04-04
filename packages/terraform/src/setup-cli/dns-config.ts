export const SETUP_DNS_DOMAINS = [
  { domain: 'gamezilla.app', outputKey: 'route53_nameservers' },
] as const;

export const CUSTOM_HTTPS_HOSTS = [
  'https://www.gamezilla.app',
] as const;

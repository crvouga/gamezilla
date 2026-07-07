export const SECRETS_DEFAULTS = {
  domain: 'https://app.infisical.com',
  env: 'dev',
} as const;

export type SecretsConfigFile = {
  readonly workspaceId: string;
  readonly defaultEnvironment?: string;
  readonly domain?: string;
};

export type ResolvedSecretsScope = {
  readonly workspaceId: string;
  readonly env: string;
  readonly domain: string;
};

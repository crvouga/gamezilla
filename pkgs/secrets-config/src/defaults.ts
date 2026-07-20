export const SECRETS_DEFAULTS = {
  env: 'dev',
} as const;

export type SecretsConfigFile = {
  readonly projectId: string;
  readonly environment?: string;
  readonly endpoint?: string;
};

export type ResolvedSecretsScope = {
  readonly projectId: string;
  readonly env: string;
  /** Secrets API base URL when set via config or `SECRETS_ADDR`; otherwise null. */
  readonly endpoint: string | null;
};

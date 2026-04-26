/** Runtime slice for URL secrets (host-based in the Worker). */
export type RuntimeEnvName = 'local' | 'prod';

/** Doppler keys in the single `shared` config — env-specific URLs. */
export const ApiUrlSecretName = {
  localDatabaseUrl: 'LOCAL_DATABASE_URL',
  prodDatabaseUrl: 'PROD_DATABASE_URL',
  localApiUrl: 'LOCAL_API_URL',
  prodApiUrl: 'PROD_API_URL',
} as const;

/** Other Doppler keys (unchanged naming). */
export const ApiSecretName = {
  googleWebClientId: 'WEB_CLIENT_GOOGLE_CLIENT_ID',
} as const;

export function databaseUrlSecretName(
  runtime: RuntimeEnvName
): typeof ApiUrlSecretName.localDatabaseUrl | typeof ApiUrlSecretName.prodDatabaseUrl {
  return runtime === 'prod'
    ? ApiUrlSecretName.prodDatabaseUrl
    : ApiUrlSecretName.localDatabaseUrl;
}

export function apiUrlSecretName(
  runtime: RuntimeEnvName
): typeof ApiUrlSecretName.localApiUrl | typeof ApiUrlSecretName.prodApiUrl {
  return runtime === 'prod'
    ? ApiUrlSecretName.prodApiUrl
    : ApiUrlSecretName.localApiUrl;
}

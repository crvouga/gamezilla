import {
  buildBetterAuthTrustedOrigins,
  type CreateBetterAuthConfig,
} from '@pkgs/auth-better-auth/server';
import type { SecretStore } from '@pkgs/secret-store';
import type { Pool } from 'pg';

import { ApiSecretName } from './secret-names';
import { resolveWebClientOrigin } from './web-client-origin';

export type BetterAuthBootConfig = {
  readonly secret: string;
  readonly baseURL: string;
  /** Expo web / production www origin for OAuth return. */
  readonly webClientOrigin: string;
  readonly googleClientId: string;
  readonly googleClientSecret: string;
  readonly trustedOrigins: readonly string[];
  readonly enableEmailPassword: boolean;
};

export async function loadBetterAuthBootConfig(args: {
  readonly secretStore: SecretStore;
  readonly apiUrlOverride?: string | null;
  readonly secretsEnv: string;
}): Promise<BetterAuthBootConfig> {
  const { secretStore, secretsEnv } = args;
  const secret = (
    await secretStore.getRequired(ApiSecretName.betterAuthSecret)
  ).readSecretValue();
  const googleClientId = (
    await secretStore.getRequired(ApiSecretName.webClientGoogleClientId)
  ).readSecretValue();
  const googleClientSecret = (
    await secretStore.getRequired(ApiSecretName.webClientGoogleClientSecret)
  ).readSecretValue();

  const override = args.apiUrlOverride?.trim();
  const baseURL =
    override !== undefined && override !== null && override.length > 0
      ? override.replace(/\/$/, '')
      : (await secretStore.getRequired(ApiSecretName.apiUrl))
          .readSecretValue()
          .replace(/\/$/, '');
  const webClientOrigin = resolveWebClientOrigin(baseURL);

  return {
    secret,
    baseURL,
    webClientOrigin,
    googleClientId,
    googleClientSecret,
    trustedOrigins: buildBetterAuthTrustedOrigins({
      apiBaseURL: baseURL,
      clientWebOrigins: [webClientOrigin],
    }),
    enableEmailPassword: secretsEnv === 'dev',
  };
}

export function betterAuthConfigForPool(
  boot: BetterAuthBootConfig,
  database: Pool
): CreateBetterAuthConfig {
  return {
    database,
    secret: boot.secret,
    baseURL: boot.baseURL,
    googleClientId: boot.googleClientId,
    googleClientSecret: boot.googleClientSecret,
    trustedOrigins: boot.trustedOrigins,
    enableEmailPassword: boot.enableEmailPassword,
  };
}

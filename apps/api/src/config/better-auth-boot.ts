import {
  type BetterAuthDatabase,
  buildBetterAuthTrustedOrigins,
  type CreateBetterAuthConfig,
} from '@pkgs/auth-better-auth/server';
import type { SecretStore } from '@pkgs/secret-store';
import type { Pool } from 'pg';

import { ApiSecretName } from './secret-names';
import { resolveWebClientOrigin } from './web-client-origin';

function trimOrNull(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export type BetterAuthBootConfig = {
  readonly secret: string;
  readonly baseURL: string;
  /** Expo web / production www origin for OAuth return. */
  readonly webClientOrigin: string;
  readonly googleClientId: string | null;
  readonly googleClientSecret: string | null;
  readonly googleEnabled: boolean;
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
  const googleClientId = trimOrNull(
    (
      await secretStore.getOptional(ApiSecretName.webClientGoogleClientId)
    )?.readSecretValue()
  );
  const googleClientSecret = trimOrNull(
    (
      await secretStore.getOptional(ApiSecretName.webClientGoogleClientSecret)
    )?.readSecretValue()
  );
  const googleEnabled = googleClientId !== null && googleClientSecret !== null;

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
    googleEnabled,
    trustedOrigins: buildBetterAuthTrustedOrigins({
      apiBaseURL: baseURL,
      clientWebOrigins: [webClientOrigin],
    }),
    enableEmailPassword: secretsEnv === 'dev',
  };
}

export function betterAuthConfigForDatabase(
  boot: BetterAuthBootConfig,
  database: BetterAuthDatabase
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

/** @deprecated Prefer {@link betterAuthConfigForDatabase}. */
export function betterAuthConfigForPool(
  boot: BetterAuthBootConfig,
  database: Pool
): CreateBetterAuthConfig {
  return betterAuthConfigForDatabase(boot, {
    kind: 'postgres',
    pool: database,
  });
}

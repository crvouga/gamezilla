import {
  buildAuthTrustedOrigins,
  type CreateAuthAppProviders,
} from '@pkgs/auth/server';
import type { SecretStore } from '@pkgs/secret-store';

import { ApiSecretName } from './secret-names';
import { resolveWebClientOrigin } from './web-client-origin';

function trimOrNull(raw: string | undefined | null): string | null {
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  return t.length > 0 ? t : null;
}

export type AuthBootConfig = {
  readonly secret: string;
  readonly baseURL: string;
  /** Expo web / production www origin for OAuth return. */
  readonly webClientOrigin: string;
  readonly googleClientId: string | null;
  readonly googleClientSecret: string | null;
  readonly googleEnabled: boolean;
  readonly trustedOrigins: readonly string[];
  /** Dev social OAuth (JSON POST) — enabled when secretsEnv is `dev`. */
  readonly enableDev: boolean;
  readonly providers: CreateAuthAppProviders;
};

export async function loadAuthBootConfig(args: {
  readonly secretStore: SecretStore;
  readonly apiUrlOverride?: string | null;
  readonly secretsEnv: string;
}): Promise<AuthBootConfig> {
  const { secretStore, secretsEnv } = args;
  const secret = (
    await secretStore.getRequired(ApiSecretName.authSecret)
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
  const enableDev = secretsEnv === 'dev';

  const override = args.apiUrlOverride?.trim();
  const baseURL =
    override !== undefined && override !== null && override.length > 0
      ? override.replace(/\/$/, '')
      : (await secretStore.getRequired(ApiSecretName.apiUrl))
          .readSecretValue()
          .replace(/\/$/, '');
  const webClientOrigin = resolveWebClientOrigin(baseURL);

  const providers: CreateAuthAppProviders = {
    ...(googleEnabled && googleClientId !== null && googleClientSecret !== null
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
          },
        }
      : {}),
    ...(enableDev ? { dev: { enabled: true as const } } : {}),
  };

  return {
    secret,
    baseURL,
    webClientOrigin,
    googleClientId,
    googleClientSecret,
    googleEnabled,
    trustedOrigins: buildAuthTrustedOrigins({
      apiBaseURL: baseURL,
      clientWebOrigins: [webClientOrigin],
    }),
    enableDev,
    providers,
  };
}

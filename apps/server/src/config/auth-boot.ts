import {
  buildAuthTrustedOrigins,
  type CreateAuthAppProviders,
} from '@pkgs/auth/server';
import {
  GOOGLE_PRODUCTION_ENDPOINTS,
  type GoogleOauthEndpoints,
} from '@pkgs/auth/shared';
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
  /** Web / production www origin for OAuth return. */
  readonly webClientOrigin: string;
  readonly googleClientId: string | null;
  readonly googleClientSecret: string | null;
  readonly googleEnabled: boolean;
  /** Where the Google conversation happens — production, or a local stand-in. */
  readonly googleEndpoints: GoogleOauthEndpoints;
  readonly trustedOrigins: readonly string[];
  readonly providers: CreateAuthAppProviders;
};

/**
 * A simulated provider serves Google's paths from one origin; production
 * spreads them across three hosts.
 */
function googleEndpointsFor(idpOrigin: string | null): GoogleOauthEndpoints {
  if (idpOrigin === null) return GOOGLE_PRODUCTION_ENDPOINTS;
  const base = idpOrigin.replace(/\/$/, '');
  return {
    authorizeUrl: `${base}/o/oauth2/v2/auth`,
    tokenUrl: `${base}/token`,
    userinfoUrl: `${base}/v1/userinfo`,
  };
}

export async function loadAuthBootConfig(args: {
  readonly secretStore: SecretStore;
  readonly apiUrlOverride?: string | null;
  /** Dynamic localhost stack web origin for OAuth callbacks. */
  readonly webClientOrigin?: string | null;
  readonly googleIdpOrigin?: string | null;
}): Promise<AuthBootConfig> {
  const { secretStore } = args;
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
  const googleEndpoints = googleEndpointsFor(args.googleIdpOrigin ?? null);

  const override = args.apiUrlOverride?.trim();
  const baseURL =
    override !== undefined && override !== null && override.length > 0
      ? override.replace(/\/$/, '')
      : (await secretStore.getRequired(ApiSecretName.apiUrl)).readSecretValue();
  const webClientOrigin =
    args.webClientOrigin?.trim() || resolveWebClientOrigin(baseURL);

  const providers: CreateAuthAppProviders = {
    ...(googleEnabled && googleClientId !== null && googleClientSecret !== null
      ? {
          google: {
            clientId: googleClientId,
            clientSecret: googleClientSecret,
            endpoints: googleEndpoints,
          },
        }
      : {}),
  };

  return {
    secret,
    baseURL,
    webClientOrigin,
    googleClientId,
    googleClientSecret,
    googleEnabled,
    googleEndpoints,
    trustedOrigins: buildAuthTrustedOrigins({
      apiBaseURL: baseURL,
      clientWebOrigins: [webClientOrigin],
    }),
    providers,
  };
}

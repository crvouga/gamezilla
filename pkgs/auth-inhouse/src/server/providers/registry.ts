/** The enabled providers, built once per auth app from configuration. */

import type { OauthProviderId } from '@pkgs/auth/shared';
import type { Clock } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import {
  type AppleProvider,
  type AppleProviderConfig,
  createAppleProvider,
} from './apple-oauth';
import {
  createGoogleProvider,
  type GoogleProviderConfig,
} from './google-oauth';
import type { OauthProviderAdapter } from './provider-identity';

export type OauthProvidersConfig = {
  readonly google?: GoogleProviderConfig;
  /** Non-production only: backed by the simulated Apple provider. */
  readonly apple?: AppleProviderConfig;
};

export type OauthProviders = {
  get(id: OauthProviderId): OauthProviderAdapter | null;
  readonly apple: AppleProvider | null;
  /** Enabled provider ids, in a stable order. */
  readonly enabled: readonly OauthProviderId[];
};

export function createOauthProviders(args: {
  readonly config: OauthProvidersConfig;
  readonly http: HttpClient;
  readonly clock: Clock;
}): OauthProviders {
  const google =
    args.config.google === undefined
      ? null
      : createGoogleProvider({ google: args.config.google, http: args.http });
  const apple =
    args.config.apple === undefined
      ? null
      : createAppleProvider({
          apple: args.config.apple,
          http: args.http,
          clock: args.clock,
        });
  const byId: Record<OauthProviderId, OauthProviderAdapter | null> = {
    google,
    apple,
  };
  return {
    get: (id) => byId[id],
    apple,
    enabled: (['google', 'apple'] as const).filter((id) => byId[id] !== null),
  };
}

/**
 * Builds the Better Auth `genericOAuth` provider config for the in-repo
 * dev IdP shipped by {@link @pkgs/dev-idp}.
 *
 * The IdP is a **standalone process** (`bun run --filter @pkgs/dev-idp dev`,
 * auto-launched by the root `bun dev` / `turbo dev`) listening on
 * `DEV_IDP_DEFAULT_ORIGIN`. Endpoints are constructed against that origin —
 * never against the API origin — so the API worker stays completely free of
 * dev-only mounts.
 */
import {
  DEV_IDP_CLIENT_ID,
  DEV_IDP_CLIENT_SECRET,
  DEV_IDP_SCOPES,
  devIdpEndpointUrl,
  resolveDevIdpOrigin,
} from '@pkgs/dev-idp/config';
import type { GenericOAuthConfig } from 'better-auth/plugins/generic-oauth';

import { DEV_PROVIDER } from '../shared/auth-entities';

export function devIdpProviderConfig(options?: {
  readonly devIdpPort?: number;
}): GenericOAuthConfig {
  const origin = resolveDevIdpOrigin(options?.devIdpPort);
  const authorizationUrl = devIdpEndpointUrl(origin, 'authorize');
  const tokenUrl = devIdpEndpointUrl(origin, 'token');
  const userInfoUrl = devIdpEndpointUrl(origin, 'userinfo');
  return {
    providerId: DEV_PROVIDER,
    clientId: DEV_IDP_CLIENT_ID,
    clientSecret: DEV_IDP_CLIENT_SECRET,
    authorizationUrl,
    tokenUrl,
    userInfoUrl,
    // Omit redirectURI to let Better Auth use its default.
    // The default is constructed based on the app's baseURL and basePath options.
    scopes: [...DEV_IDP_SCOPES],
    pkce: true,
    authentication: 'post',
  };
}

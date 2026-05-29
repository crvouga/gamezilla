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
  DEV_IDP_DEFAULT_ORIGIN,
  DEV_IDP_SCOPES,
  devIdpEndpointUrl,
} from '@pkgs/dev-idp/config';
import type { GenericOAuthConfig } from 'better-auth/plugins/generic-oauth';

import { DEV_PROVIDER } from '../shared/auth-entities';

export function devIdpProviderConfig(): GenericOAuthConfig {
  return {
    providerId: DEV_PROVIDER,
    clientId: DEV_IDP_CLIENT_ID,
    clientSecret: DEV_IDP_CLIENT_SECRET,
    authorizationUrl: devIdpEndpointUrl(DEV_IDP_DEFAULT_ORIGIN, 'authorize'),
    tokenUrl: devIdpEndpointUrl(DEV_IDP_DEFAULT_ORIGIN, 'token'),
    userInfoUrl: devIdpEndpointUrl(DEV_IDP_DEFAULT_ORIGIN, 'userinfo'),
    scopes: [...DEV_IDP_SCOPES],
    pkce: true,
    authentication: 'post',
  };
}

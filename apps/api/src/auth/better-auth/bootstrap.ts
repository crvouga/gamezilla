import type { SecretStore } from '@gamezilla/lib/secret-store';
import type { Hono } from 'hono';
import { withBetterAuthBrowserCorsForRequest } from '../../app/cors';
import type { ApiWorkerEnv } from '../../config/env';
import type { HttpBearerAuthPorts } from '../ports';
import { betterAuthAccountProvisioning } from './account-provisioning';
import { createBetterAuthInstance } from './create-better-auth';
import { SessionClaimsBetterAuthAdapter } from './session-claims-port';

type AuthInstance = Awaited<ReturnType<typeof createBetterAuthInstance>>;

type HostedAuthStack = {
  readonly auth: AuthInstance;
  readonly bearerAuth: HttpBearerAuthPorts;
};

let stackPromise: Promise<HostedAuthStack> | null = null;

async function getHostedAuthStack(
  secretStore: SecretStore
): Promise<HostedAuthStack> {
  stackPromise ??= (async (): Promise<HostedAuthStack> => {
    const auth = await createBetterAuthInstance(secretStore);
    return {
      auth,
      bearerAuth: {
        sessionClaims: new SessionClaimsBetterAuthAdapter(auth),
        accountProvisioning: betterAuthAccountProvisioning,
      },
    };
  })();
  return stackPromise;
}

export async function createBetterAuthHttpBearerAuthPorts(
  secretStore: SecretStore
): Promise<HttpBearerAuthPorts> {
  return (await getHostedAuthStack(secretStore)).bearerAuth;
}

export async function mountHostedAuthRoutes(
  app: Hono<{ Bindings: ApiWorkerEnv }>,
  secretStore: SecretStore
): Promise<void> {
  const { auth } = await getHostedAuthStack(secretStore);
  app.all('/api/auth/*', async (c) => {
    const req = c.req.raw;
    const res = await auth.handler(req);
    return withBetterAuthBrowserCorsForRequest(req, res);
  });
}

import type { AuthProvider, AuthProviderModule } from '@pkgs/auth/server';
import type { Clock } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import type { SecretStore } from '@pkgs/secret-store';
import type { CreateId } from '@pkgs/uuid';

import { requireRequestStore } from '../request-scope';
import type { DeploymentProtection } from './env';
import { ApiSecretName } from './secret-names';
import { resolveWebClientOrigin } from './web-client-origin';

/** The path the API serves under; the auth service's routes sit beneath it. */
export const API_PATH_PREFIX = '/api';

/** Binding for the web origin sign-in redirects return to (rendered per env by `@libs/infra`; the localhost stack sets its own). */
export const WEB_CLIENT_ORIGIN_BINDING = 'WEB_CLIENT_ORIGIN';

async function readOptional(
  secretStore: SecretStore,
  name: string
): Promise<string | null> {
  const raw = (await secretStore.getOptional(name))?.readSecretValue();
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed.length > 0 ? trimmed : null;
}

async function resolveApiOrigin(
  secretStore: SecretStore,
  apiUrlOverride: string | null
): Promise<string> {
  const override = apiUrlOverride?.trim() ?? '';
  const raw =
    override.length > 0
      ? override
      : (await secretStore.getRequired(ApiSecretName.apiUrl)).readSecretValue();
  return raw.replace(/\/$/, '');
}

/**
 * Builds the auth service the composition root chose. The server names no
 * service: it hands the module the deployment's secrets and the API's
 * coordinates, and keeps only the provider-neutral result.
 */
export async function createAuthProvider(args: {
  readonly module: AuthProviderModule;
  readonly secretStore: SecretStore;
  readonly apiUrlOverride: string | null;
  readonly protection: DeploymentProtection;
  readonly clock: Clock;
  readonly createId: CreateId;
  readonly http: HttpClient;
}): Promise<AuthProvider> {
  const { secretStore } = args;
  const apiOrigin = await resolveApiOrigin(secretStore, args.apiUrlOverride);
  const webClientOrigin =
    (await readOptional(secretStore, WEB_CLIENT_ORIGIN_BINDING)) ??
    resolveWebClientOrigin(apiOrigin);
  return await args.module.create({
    readSecret: (name) => readOptional(secretStore, name),
    isProduction: args.protection === 'production',
    apiOrigin,
    apiPathPrefix: API_PATH_PREFIX,
    clientOrigins: [webClientOrigin],
    clock: args.clock,
    createId: args.createId,
    http: args.http,
    getSql: () => requireRequestStore().sqlClient,
  });
}

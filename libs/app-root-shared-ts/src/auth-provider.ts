import { PRODUCT } from '@libs/product-identity-shared-ts/product-identity';
import type {
  AuthProvider,
  AuthProviderModule,
} from '@pkgs/auth-root-shared-ts/auth-provider-module';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import type { SecretStore } from '@pkgs/secret-store-shared-ts/interface';
import type { CreateId } from '@pkgs/uuid-shared-ts/create-id';
import type { DeploymentProtection } from './env';
import { requireRequestStore } from './request-scope';
import { ApiSecretName } from './secret-names';
import { resolveWebClientOrigin } from './web-client-origin';

/** The path the API serves under; the auth service's routes sit beneath it. */
export const API_PATH_PREFIX = '/api';

/** Binding for the web origin sign-in redirects return to (rendered per env by `@libs/infra`; the localhost stack sets its own). */
export const WEB_CLIENT_ORIGIN_BINDING = 'WEB_CLIENT_ORIGIN';

/** The environment's second public web host, when it serves the app. */
export const WEB_CLIENT_APEX_ORIGIN_BINDING = 'WEB_CLIENT_APEX_ORIGIN';

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
  /** The built service told the product a user's sign-in methods changed. */
  readonly onUserChanged: (
    auth: AuthProvider,
    externalUserId: string
  ) => Promise<void>;
}): Promise<AuthProvider> {
  const { secretStore } = args;
  const apiOrigin = await resolveApiOrigin(secretStore, args.apiUrlOverride);
  const webClientOrigin =
    (await readOptional(secretStore, WEB_CLIENT_ORIGIN_BINDING)) ??
    resolveWebClientOrigin(apiOrigin);
  const apexOrigin = await readOptional(
    secretStore,
    WEB_CLIENT_APEX_ORIGIN_BINDING
  );
  const auth: AuthProvider = await args.module.create({
    readSecret: (name) => readOptional(secretStore, name),
    isProduction: args.protection === 'production',
    apiOrigin,
    apiPathPrefix: API_PATH_PREFIX,
    clientOrigins: [
      webClientOrigin,
      ...(apexOrigin === null ? [] : [apexOrigin]),
    ],
    clientSchemes: [PRODUCT.external.deepLinkScheme],
    clock: args.clock,
    createId: args.createId,
    http: args.http,
    getSql: () => requireRequestStore().sqlClient,
    // Only ever called while serving a request, long after `auth` is built.
    onUserChanged: (externalUserId) => args.onUserChanged(auth, externalUserId),
  });
  return auth;
}

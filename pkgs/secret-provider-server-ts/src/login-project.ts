import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import {
  infisicalProjectEnv,
  infisicalProjectProfile,
} from '@pkgs/secret-provider-shared-ts/infisical-auth';
import { resolveInfisicalEndpoint } from '@pkgs/secret-provider-shared-ts/resolve-endpoint';
import { resolveSecretsScope } from '@pkgs/secrets-config-server-ts/secrets-scope';

type LoginPorts = {
  readonly env: Readonly<Record<string, string | undefined>>;
  readonly run: (
    args: readonly string[],
    env: Readonly<Record<string, string | undefined>>
  ) => number;
};

/** A named login leaves other projects' sessions alone and binds only this checkout. */
export async function loginProject(
  store: ObjectStore,
  repoRoot: string,
  ports: LoginPorts
): Promise<number> {
  const scope = await resolveSecretsScope(store);
  const domain = resolveInfisicalEndpoint(scope);
  const profile = infisicalProjectProfile(
    { workspaceId: scope.projectId, domain },
    ports.env
  );
  const env = infisicalProjectEnv(ports.env);
  for (const key of [
    'INFISICAL_TOKEN',
    'INFISICAL_ACCESS_TOKEN',
    'SECRETS_TOKEN',
    'INFISICAL_ORGANIZATION_ID',
    'INFISICAL_EMAIL',
    'INFISICAL_PASSWORD',
  ])
    delete env[key];
  const code = ports.run(
    ['login', '--domain', domain, '--save-as', profile],
    env
  );
  if (code !== 0) return code;
  return ports.run(
    ['profile', 'bind', profile, repoRoot, '--domain', domain],
    env
  );
}

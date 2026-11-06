import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { capture } from '@pkgs/os-server-ts/command';
import {
  infisicalProjectEnv,
  infisicalProjectProfile,
} from '@pkgs/secret-provider-shared-ts/infisical-auth';
import { resolveInfisicalEndpoint } from '@pkgs/secret-provider-shared-ts/resolve-endpoint';
import { resolveSecretsScope } from '@pkgs/secrets-config-server-ts/secrets-scope';

/** The local provider token comes from this project's session, never the global login. */
export async function localSessionToken(
  configStore: ObjectStore,
  repoRoot: string
): Promise<string> {
  const scope = await resolveSecretsScope(configStore);
  const domain = resolveInfisicalEndpoint(scope);
  const profile = infisicalProjectProfile(
    { workspaceId: scope.projectId, domain },
    process.env
  );
  const session = capture(
    'infisical',
    [
      'user',
      'get',
      'token',
      '--plain',
      '--domain',
      domain,
      '--profile',
      profile,
    ],
    {
      cwd: repoRoot,
      env: infisicalProjectEnv(process.env),
      timeoutMs: 20_000,
    }
  );
  const token = session.stdout.trim();
  if (session.status === 0 && token.length > 0) return token;
  throw new Error(
    'Infisical project session unavailable; run `bun run secrets:login`.'
  );
}

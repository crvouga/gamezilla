/**
 * `DATABASE_URL` for the puzzle tooling scripts (seed, load-file export,
 * validation job), behind the repo's database-url policy: a non-production
 * environment must not point at any production database; a production one is
 * allowed (the scripts are how production gets seeded and checked).
 * Production-ness is the env file's `protection`, never the env's name.
 */
import type { EnvFile } from '@libs/infra-shared/env-file';
import { isProductionEnv } from '@libs/infra-shared/env-file';
import { envFile, PRODUCTION_ENV_NAMES } from '@libs/infra-shared/envs';
import { assertNonProdDatabaseUrlForTooling } from '@pkgs/database-url-policy-server/database-url-policy-tooling';
import type { HttpClient } from '@pkgs/http-client-shared/types';
import type { ObjectStore } from '@pkgs/object-store-shared/interface';
import { createScriptSecretStore } from '@pkgs/secret-store-shared/create-script-secret-store';
import { resolveSecretsScope } from '@pkgs/secrets-config-server/secrets-scope';

export type ToolingDatabaseUrlArgs = {
  readonly configStore: ObjectStore;
  readonly http: HttpClient;
  readonly repoRoot: string;
  /** Policy surface label (`chess:seed-puzzles`, …). */
  readonly surface: string;
  /** Called with the resolved env before the URL is read (extra guards). */
  readonly guardEnv?: (env: EnvFile) => void;
};

export async function resolveToolingDatabaseUrl(
  args: ToolingDatabaseUrlArgs
): Promise<{ readonly databaseUrl: string; readonly env: EnvFile }> {
  const env = envFile(
    process.env['SECRETS_ENV']?.trim() ||
      (await resolveSecretsScope(args.configStore)).env
  );
  args.guardEnv?.(env);
  const databaseUrl = (
    await createScriptSecretStore().getRequired('DATABASE_URL')
  ).readSecretValue();
  if (!isProductionEnv(env)) {
    await assertNonProdDatabaseUrlForTooling(
      databaseUrl,
      {
        repoRoot: args.repoRoot,
        fetchFn: (input, init) => args.http.fetch(input, init),
        productionEnvs: PRODUCTION_ENV_NAMES,
      },
      { surface: args.surface, secretsEnv: env.env }
    );
  }
  return { databaseUrl, env };
}

/**
 * `DATABASE_URL` for the puzzle tooling scripts (seed, load-file export,
 * validation job), behind the repo's database-url policy: `dev` must be a
 * non-production URL; `prd` is allowed (the scripts are how production gets
 * seeded and checked).
 */
import {
  assertDevSecretsEnv,
  PRODUCTION_SECRETS_ENV,
} from '@pkgs/database-url-policy';
import { assertDatabaseUrlAllowedForSecretsEnvForTooling } from '@pkgs/database-url-policy/database-url-policy-tooling';
import type { HttpClient } from '@pkgs/http-client';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { createScriptSecretStore } from '@pkgs/secret-store';
import { resolveSecretsScope } from '@pkgs/secrets-config/index';

export type ToolingDatabaseUrlArgs = {
  readonly configStore: ObjectStore;
  readonly http: HttpClient;
  readonly repoRoot: string;
  /** Policy surface label (`chess:seed-puzzles`, …). */
  readonly surface: string;
  /** Called with the resolved env before the URL is read (extra guards). */
  readonly guardSecretsEnv?: (secretsEnv: string) => void;
};

export async function resolveToolingDatabaseUrl(
  args: ToolingDatabaseUrlArgs
): Promise<{ readonly databaseUrl: string; readonly secretsEnv: string }> {
  const secretsEnv =
    process.env['SECRETS_ENV']?.trim() ||
    (await resolveSecretsScope(args.configStore)).env;
  args.guardSecretsEnv?.(secretsEnv);
  if (secretsEnv !== PRODUCTION_SECRETS_ENV) {
    assertDevSecretsEnv(secretsEnv);
  }
  const databaseUrl = (
    await createScriptSecretStore().getRequired('DATABASE_URL')
  ).readSecretValue();
  await assertDatabaseUrlAllowedForSecretsEnvForTooling(
    databaseUrl,
    secretsEnv,
    {
      deps: {
        repoRoot: args.repoRoot,
        fetchFn: (input, init) => args.http.fetch(input, init),
      },
      context: { surface: args.surface },
    }
  );
  return { databaseUrl, secretsEnv };
}

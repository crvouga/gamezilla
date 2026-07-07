import type { SecretStore } from '@pkgs/secret-store/interface';
import { createEnvSecretStore } from '@pkgs/secret-store/impl-env';

/**
 * Script-side store: reads secrets already injected into `process.env`
 * by `secrets-run` / CI / `infisical run`.
 */
export function createScriptSecretStore(
  env: NodeJS.ProcessEnv = process.env
): SecretStore {
  const record: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(env)) {
    record[key] = value;
  }
  return createEnvSecretStore(record);
}

import { createEnvSecretStore } from './impl-env';
import type { SecretStore } from './interface';

/**
 * Run-side store: reads secrets already injected into `process.env`
 * by `secrets-run` / CI / local secret injection.
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

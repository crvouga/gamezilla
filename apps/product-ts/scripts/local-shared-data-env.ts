// @io-wall-ok — localhost shared-reference-data composition root.
import { exportSecretsMap } from '@libs/secrets-server-ts/secrets-io';
import { SHARED_DATA_SECRET_NAMES } from '@libs/secrets-shared-ts/shared-data-credentials';

/** Only the explicitly shared bucket crosses from deployed bindings into local APIs. */
export async function localSharedDataEnv(
  source: Readonly<Record<string, string | undefined>>
) {
  const complete = SHARED_DATA_SECRET_NAMES.every((name) => source[name]);
  const cached = complete
    ? new Map<string, string>()
    : await exportSecretsMap('dev').catch(() => new Map<string, string>());
  return Object.fromEntries(
    SHARED_DATA_SECRET_NAMES.flatMap((name) => {
      const value = source[name] ?? cached.get(name);
      return value ? [[name, value]] : [];
    })
  );
}

/** Automated stack hosts inject their disposable store; gates never write shared data. */
export function isolatedSharedDataEnv(infra: Readonly<Record<string, string>>) {
  return Object.fromEntries(
    SHARED_DATA_SECRET_NAMES.flatMap((name) => {
      const value = infra[name.replace('SHARED_DATA_', 'S3_')];
      return value ? [[name, value]] : [];
    })
  );
}

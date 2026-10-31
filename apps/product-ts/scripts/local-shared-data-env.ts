// @io-wall-ok — localhost shared-reference-data composition root.
import { SHARED_DATA_SECRET_NAMES } from '@libs/secrets-shared-ts/shared-data-credentials';

/** Local stack hosts use their disposable store; they never access deployed shared data. */
export function isolatedSharedDataEnv(infra: Readonly<Record<string, string>>) {
  return Object.fromEntries(
    SHARED_DATA_SECRET_NAMES.flatMap((name) => {
      const value = infra[name.replace('SHARED_DATA_', 'S3_')];
      return value ? [[name, value]] : [];
    })
  );
}

import { appObjectStoreRootPrefix } from '@libs/db-shared-ts/scope';
import { SHARED_DATA_SECRET_NAMES } from '@libs/secrets-shared-ts/shared-data-credentials';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import { createS3ObjectStore } from '@pkgs/object-store-s3-server-ts/impl-s3';
import type { SecretStore } from '@pkgs/secret-store-shared-ts/interface';

export async function createSharedDataStore(
  secrets: SecretStore,
  http: HttpClient
) {
  const values = await secrets.getOptionalMany(SHARED_DATA_SECRET_NAMES);
  if (SHARED_DATA_SECRET_NAMES.some((name) => values[name] === null))
    return null;
  const read = (name: (typeof SHARED_DATA_SECRET_NAMES)[number]) =>
    values[name]!.readSecretValue();
  return createS3ObjectStore({
    bucket: read('SHARED_DATA_BUCKET'),
    endpoint: read('SHARED_DATA_ENDPOINT'),
    region: read('SHARED_DATA_REGION'),
    accessKeyId: read('SHARED_DATA_ACCESS_KEY_ID'),
    secretAccessKey: read('SHARED_DATA_SECRET_ACCESS_KEY'),
    rootPrefix: appObjectStoreRootPrefix(),
    http,
  });
}

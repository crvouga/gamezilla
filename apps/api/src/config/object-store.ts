import type { ObjectStore } from '@pkgs/object-store/interface';
import { B2DopplerKey } from '@pkgs/object-store/b2-config';
import { createB2ObjectStore } from '@pkgs/object-store/impl-b2';
import type { SecretStore } from '@pkgs/secret-store';

/**
 * Backblaze B2 object store for the API Worker. Credentials are loaded from
 * Doppler at boot; every key is scoped under `gamezilla/` inside
 * {@link createB2ObjectStore}.
 */
export async function createApiObjectStore(
  secretStore: SecretStore
): Promise<ObjectStore> {
  const [applicationKeyId, applicationKey, bucketName, s3Endpoint, s3Region] =
    await Promise.all([
      secretStore.getRequired(B2DopplerKey.applicationKeyId),
      secretStore.getRequired(B2DopplerKey.applicationKey),
      secretStore.getRequired(B2DopplerKey.bucketName),
      secretStore.getRequired(B2DopplerKey.s3Endpoint),
      secretStore.getRequired(B2DopplerKey.s3Region),
    ]);

  return createB2ObjectStore({
    applicationKeyId: applicationKeyId.readSecretValue(),
    applicationKey: applicationKey.readSecretValue(),
    bucketName: bucketName.readSecretValue(),
    s3Endpoint: s3Endpoint.readSecretValue(),
    s3Region: s3Region.readSecretValue(),
  });
}

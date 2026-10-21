import { REPORTS_ROOT_PREFIX } from '@crvouga/atlas/reports/keys';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { createS3ObjectStore } from '@pkgs/object-store-s3-server-ts/impl-s3';
import type { SecretStore } from '@pkgs/secret-store-shared-ts/interface';

import { REPORTS_KEYS } from './atlas-reports-credentials';

/**
 * The shared spec reports store (one R2 bucket Atlas reads, keyed
 * by commit; `/api/reports`), through the tooling read-only
 * credential. Null without one: the reports routes then answer 503.
 */
export async function createReportsObjectStore(
  secretStore: SecretStore,
  options: { readonly http: HttpClient }
): Promise<ObjectStore | null> {
  const secrets = await secretStore.getOptionalMany(REPORTS_KEYS);
  const value = (name: (typeof REPORTS_KEYS)[number]): string | null =>
    secrets[name]?.readSecretValue().trim() || null;
  const bucket = value('REPORTS_BUCKET');
  const endpoint = value('REPORTS_ENDPOINT');
  const accessKeyId = value('REPORTS_ACCESS_KEY_ID');
  const secretAccessKey = value('REPORTS_SECRET_ACCESS_KEY');
  if (
    bucket === null ||
    endpoint === null ||
    accessKeyId === null ||
    secretAccessKey === null
  ) {
    return null;
  }
  return createS3ObjectStore({
    accessKeyId,
    secretAccessKey,
    bucket,
    endpoint,
    region: 'auto',
    rootPrefix: REPORTS_ROOT_PREFIX,
    http: options.http,
  });
}

// @io-wall-ok — reports CLI composition root.
import { REPORTS_ROOT_PREFIX } from '@crvouga/atlas/reports/keys';
import { createGlobalHttpClient } from '@pkgs/http-client-shared-ts/global';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { createS3ObjectStore } from '@pkgs/object-store-s3-server-ts/impl-s3';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not set (run under secrets-run)`);
  return value;
}

export function reportsStore(): ObjectStore {
  return createS3ObjectStore({
    bucket: required('REPORTS_BUCKET'),
    endpoint: required('REPORTS_ENDPOINT'),
    accessKeyId: required('REPORTS_WRITE_ACCESS_KEY_ID'),
    secretAccessKey: required('REPORTS_WRITE_SECRET_ACCESS_KEY'),
    region: 'auto',
    rootPrefix: REPORTS_ROOT_PREFIX,
    http: createGlobalHttpClient(),
  });
}

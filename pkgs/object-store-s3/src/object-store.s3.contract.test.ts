/**
 * Dual-backend contract: the same suite against the in-process
 * `@crvouga/mockingbird-service-s3` mock (always) and live S3-compatible
 * storage (local MinIO / R2) when `S3_ENDPOINT` + credentials are present.
 */

import { describe } from 'bun:test';
import { createRuntime } from '@crvouga/mockingbird-service-s3';
import { createSettableClock, wallClock } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client';
import type { ObjectStore } from '@pkgs/object-store/interface';
import { runObjectStoreContractTests } from '@pkgs/object-store/object-store-contract';
import { normalizeObjectStoreRootPrefix } from '@pkgs/object-store/prefixes';
import { createSimAdapters } from '@pkgs/uuid';
import { createS3ObjectStore } from './impl-s3';

const endpoint = process.env['S3_ENDPOINT']?.trim() ?? '';
const accessKeyId = process.env['S3_ACCESS_KEY_ID']?.trim() ?? '';
const secretAccessKey = process.env['S3_SECRET_ACCESS_KEY']?.trim() ?? '';
const bucket = process.env['S3_BUCKET']?.trim() ?? '';
const region = process.env['S3_REGION']?.trim() ?? 'us-east-1';
const HAS_S3 =
  endpoint.length > 0 &&
  accessKeyId.length > 0 &&
  secretAccessKey.length > 0 &&
  bucket.length > 0;

const MOCK_ENDPOINT = 'http://s3.mockingbird.test';
const MOCK_BUCKET = 'contract';

/** Real S3 adapter over a fresh in-process mockingbird S3 runtime. */
async function createMockingbirdS3Store(): Promise<ObjectStore> {
  const s3 = createRuntime({ clock: createSettableClock(wallClock) });
  const http: HttpClient = {
    fetch: (input, init) => s3.fetch(new Request(input, init)),
  };
  await http.fetch(`${MOCK_ENDPOINT}/${MOCK_BUCKET}`, { method: 'PUT' });
  return createS3ObjectStore({
    // Mockingbird's default fixture credential pair.
    accessKeyId: 'fixture',
    secretAccessKey: 'fixture',
    bucket: MOCK_BUCKET,
    endpoint: MOCK_ENDPOINT,
    region: 'us-east-1',
    rootPrefix: 'dst-contract/',
    http,
  });
}

describe('ObjectStore S3/mockingbird (contract)', () => {
  runObjectStoreContractTests(createMockingbirdS3Store);
});

describe.skipIf(!HAS_S3)('ObjectStore S3/MinIO (contract)', () => {
  const adapters = createSimAdapters({ seed: 1 });
  const prefix = normalizeObjectStoreRootPrefix(
    `dst-contract/${adapters.createId()}/`
  );

  runObjectStoreContractTests(() =>
    createS3ObjectStore({
      accessKeyId,
      secretAccessKey,
      bucket,
      endpoint,
      region,
      rootPrefix: prefix,
      http: { fetch: (input, init) => globalThis.fetch(input, init) },
    })
  );
});

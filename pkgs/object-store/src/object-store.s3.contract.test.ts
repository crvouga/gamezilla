/**
 * Dual-backend contract: same suite against live S3-compatible storage
 * (local MinIO / B2) when `S3_ENDPOINT` + credentials are present.
 */
import { describe } from 'bun:test';
import { createSimIo } from '@pkgs/io';

import { createS3ObjectStore } from './impl-s3';
import { runObjectStoreContractTests } from './object-store-contract';
import { normalizeObjectStoreRootPrefix } from './prefixes';

const endpoint = process.env['S3_ENDPOINT']?.trim() ?? '';
const accessKeyId = process.env['B2_APP_KEY_ID']?.trim() ?? '';
const secretAccessKey = process.env['B2_APP_KEY']?.trim() ?? '';
const bucket = process.env['S3_BUCKET']?.trim() ?? '';
const region = process.env['S3_REGION']?.trim() ?? 'us-east-1';
const HAS_S3 =
  endpoint.length > 0 &&
  accessKeyId.length > 0 &&
  secretAccessKey.length > 0 &&
  bucket.length > 0;

describe.skipIf(!HAS_S3)('ObjectStore S3/MinIO (contract)', () => {
  const io = createSimIo({ seed: 1 });
  const prefix = normalizeObjectStoreRootPrefix(
    `dst-contract/${io.createId()}/`
  );

  runObjectStoreContractTests(() =>
    createS3ObjectStore({
      accessKeyId,
      secretAccessKey,
      bucket,
      endpoint,
      region,
      rootPrefix: prefix,
    })
  );
});

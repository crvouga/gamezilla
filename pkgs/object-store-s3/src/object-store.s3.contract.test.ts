// goal:the-bar:5 — S3-compatible object store contract runs against
// local S3rver or externally supplied S3/R2 env vars.

import { afterAll, describe } from 'bun:test';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runObjectStoreContractTests } from '@pkgs/object-store/object-store-contract';
import { normalizeObjectStoreRootPrefix } from '@pkgs/object-store/prefixes';
import {
  S3_ACCESS_KEY_ID,
  S3_BUCKET,
  S3_REGION,
  S3_SECRET_ACCESS_KEY,
  startS3Server,
} from '@pkgs/s3-server';
import { createHarnessAdapters } from '@pkgs/uuid';
import { createS3ObjectStore } from './impl-s3';

const endpoint = process.env['S3_ENDPOINT']?.trim() ?? '';
const accessKeyId = process.env['S3_ACCESS_KEY_ID']?.trim() ?? '';
const secretAccessKey = process.env['S3_SECRET_ACCESS_KEY']?.trim() ?? '';
const bucket = process.env['S3_BUCKET']?.trim() ?? '';
const region = process.env['S3_REGION']?.trim() ?? S3_REGION;

let s3Config: {
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  region: string;
};
let stopS3: (() => Promise<void>) | undefined;

// When no S3 endpoint is supplied, start local S3rver.
if (!endpoint) {
  const dir = join(tmpdir(), `s3-contract-${randomUUID()}`);
  const handle = await startS3Server({ directory: dir });
  s3Config = {
    endpoint: handle.endpoint,
    accessKeyId: S3_ACCESS_KEY_ID,
    secretAccessKey: S3_SECRET_ACCESS_KEY,
    bucket: S3_BUCKET,
    region: S3_REGION,
  };
  stopS3 = () => handle.stop();
} else {
  s3Config = {
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    region,
  };
}

describe('ObjectStore S3-compatible (contract)', () => {
  const adapters = createHarnessAdapters({ seed: 1 });
  const prefix = normalizeObjectStoreRootPrefix(
    `dst-contract/${adapters.createId()}/`
  );

  runObjectStoreContractTests(() =>
    createS3ObjectStore({
      ...s3Config,
      rootPrefix: prefix,
      http: { fetch: (input, init) => globalThis.fetch(input, init) },
    })
  );
});

afterAll(async () => {
  await stopS3?.();
});

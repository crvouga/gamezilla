#!/usr/bin/env bun
// @io-wall-ok — CLI entry: deletes a torn-down environment's objects.
/**
 * Empties the environment's object bucket so its teardown can delete it (R2
 * refuses to delete a bucket that still holds objects). Run only by
 * `destroy-env.ts`, under `secrets-run` for that environment: the bucket and
 * its credential come from the env's own `S3_*` secrets, so it can never
 * reach another environment's bucket.
 */
import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  S3Client,
} from '@aws-sdk/client-s3';
import { envFile } from '@libs/infra-shared/envs';
import { fail } from './tofu-process';

function required(name: string): string {
  const value = (process.env[name] ?? '').trim();
  if (value.length === 0) fail(`${name} is required (run through secrets-run)`);
  return value;
}

const env = envFile(required('SECRETS_ENV'));
if (env.protection !== 'standard') {
  fail(`${env.env} is a production environment; its bucket is never emptied`);
}

// A resumed teardown may already have destroyed foundation (and with it the
// env's S3 secrets): nothing is left to empty.
const bucket = (process.env['S3_BUCKET'] ?? '').trim();
if (bucket.length === 0) {
  console.log(`[infra] ${env.env}: no S3_BUCKET — bucket already gone`);
  process.exit(0);
}
const client = new S3Client({
  region: (process.env['S3_REGION'] ?? '').trim() || 'auto',
  endpoint: required('S3_ENDPOINT'),
  forcePathStyle: true,
  credentials: {
    accessKeyId: required('S3_ACCESS_KEY_ID'),
    secretAccessKey: required('S3_SECRET_ACCESS_KEY'),
  },
});

let deleted = 0;
for (;;) {
  const page = await client.send(new ListObjectsV2Command({ Bucket: bucket }));
  const keys = (page.Contents ?? []).flatMap((o) =>
    o.Key === undefined ? [] : [{ Key: o.Key }]
  );
  if (keys.length === 0) break;
  await client.send(
    new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } })
  );
  deleted += keys.length;
}
client.destroy();
console.log(
  `[infra] ${env.env}: emptied ${bucket} (${String(deleted)} objects)`
);

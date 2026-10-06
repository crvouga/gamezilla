import { createRuntime } from '@crvouga/mockingbird-service-s3';
import type { Clock } from '@pkgs/clock-shared/types';
import { createS3ObjectStore } from '@pkgs/object-store-s3-server/impl-s3';
import { mockingbirdClock } from './mockingbird-clock';

/** Real S3 commands and signing against an isolated Mockingbird runtime, with no sockets. */
export function createHarnessObjectStore(clock: Clock) {
  const runtime = createRuntime({
    clock: mockingbirdClock(clock),
    buckets: ['harness'],
    credentials: { fixture: 'fixture' },
  });
  return createS3ObjectStore({
    accessKeyId: 'fixture',
    secretAccessKey: 'fixture',
    bucket: 'harness',
    endpoint: 'http://s3.mock',
    region: 'us-east-1',
    rootPrefix: 'harness/',
    http: { fetch: (input, init) => runtime.fetch(new Request(input, init)) },
  });
}

import { createRuntime } from '@crvouga/mockingbird-service-s3';
import type { Clock } from '@pkgs/clock-shared-ts/types';
import type { ObjectStore } from '@pkgs/object-store-root-shared-ts/interface';
import { createS3ObjectStore } from '@pkgs/object-store-s3-server-ts/impl-s3';
import { mockingbirdClock } from './mockingbird-clock';

/** Real S3 commands and signing against an isolated Mockingbird runtime, with no sockets. */
export function createHarnessObjectStore(clock: Clock) {
  const runtime = createRuntime({
    clock: mockingbirdClock(clock),
    buckets: ['harness'],
    credentials: { fixture: 'fixture' },
  });
  const store = createS3ObjectStore({
    accessKeyId: 'fixture',
    secretAccessKey: 'fixture',
    bucket: 'harness',
    endpoint: 'http://s3.mock',
    region: 'us-east-1',
    rootPrefix: 'harness/',
    http: { fetch: (input, init) => runtime.fetch(new Request(input, init)) },
  });
  return Object.assign(store, {
    failNextWrite: () =>
      runtime.faults.add({
        id: 'harness-next-object-write',
        method: 'PUT',
        status: 503,
        count: 1,
        body: 'Object storage unavailable',
      }),
  });
}

/** Fault the vendor's next PUT, while retaining the real S3 client path. */
export function failNextHarnessObjectWrite(store: ObjectStore): void {
  if (!hasWriteFaultControl(store)) {
    throw new Error('Object storage fault control is not mounted');
  }
  store.failNextWrite();
}

function hasWriteFaultControl(
  store: ObjectStore
): store is ObjectStore & { failNextWrite: () => void } {
  return 'failNextWrite' in store && typeof store.failNextWrite === 'function';
}

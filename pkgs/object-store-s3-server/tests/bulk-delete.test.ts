import { expect, test } from 'bun:test';
import { createS3ObjectStore } from '@pkgs/object-store-s3-server/impl-s3';

// regression: s3-ignores-injected-http
// regression: s3-bulk-delete-browser-request-order
test('bulk delete uses at most 1,000 keys per request and refuses namespace escapes before deleting', async () => {
  const requests: string[] = [];
  const store = createS3ObjectStore({
    bucket: 'reports',
    endpoint: 'https://s3.test',
    region: 'auto',
    rootPrefix: 'reports',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
    http: {
      async fetch(_input, init) {
        requests.push(String(init?.body));
        return new Response(
          '<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"/>'
        );
      },
    },
  });
  await store.deleteMany(Array.from({ length: 1_001 }, (_, n) => `old/${n}`));
  expect(requests).toHaveLength(2);
  const batches = requests
    .map((body) =>
      [...body.matchAll(/<Key>([^<]*)<\/Key>/g)].map((match) => match[1])
    )
    .sort((left, right) => right.length - left.length);
  expect(batches[0]).toEqual(
    Array.from({ length: 1_000 }, (_, n) => `reports/old/${n}`)
  );
  expect(batches[1]).toEqual(['reports/old/1000']);
  expect(() => store.deleteMany(['valid', '../escape'])).toThrow();
  expect(requests).toHaveLength(2);
});

test('bulk delete propagates partial failures from a successful HTTP response', async () => {
  const store = createS3ObjectStore({
    bucket: 'reports',
    endpoint: 'https://s3.test',
    region: 'auto',
    rootPrefix: 'reports',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
    http: {
      async fetch() {
        return new Response(
          '<DeleteResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Error><Key>reports/old</Key><Code>AccessDenied</Code></Error></DeleteResult>'
        );
      },
    },
  });
  await expect(store.deleteMany(['old'])).rejects.toThrow('bulk delete failed');
});

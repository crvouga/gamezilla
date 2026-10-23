import { expect, test } from 'bun:test';
import { createS3ObjectStore } from '@pkgs/object-store-s3-server-ts/impl-s3';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import fc from 'fast-check';

function listingStore(keys: readonly string[], holdChildren = false) {
  let active = 0;
  let peak = 0;
  let requests = 0;
  let children = 0;
  const pair = Promise.withResolvers<void>();
  const wireKeys = keys.map((key) => `reports/${key}`).sort();
  const store = createS3ObjectStore({
    bucket: 'reports',
    endpoint: 'https://s3.test',
    region: 'auto',
    rootPrefix: 'reports',
    accessKeyId: 'key',
    secretAccessKey: 'secret',
    http: {
      async fetch(input) {
        requests += 1;
        active += 1;
        peak = Math.max(peak, active);
        await Promise.resolve();
        await Promise.resolve();
        const url = new URL(String(input));
        const prefix = url.searchParams.get('prefix') ?? '';
        // Browser SigV4 completes asynchronously. Hold the first child until
        // another arrives, so overlap does not depend on signing speed.
        if (holdChildren && prefix.includes('/source-')) {
          children += 1;
          if (children === 2) pair.resolve();
          await pair.promise;
        }
        const delimiter = url.searchParams.get('delimiter');
        const entries = [
          ...new Set(
            wireKeys
              .filter((key) => key.startsWith(prefix))
              .map((key) => {
                const slash = delimiter
                  ? key.indexOf(delimiter, prefix.length)
                  : -1;
                return slash < 0 ? key : key.slice(0, slash + 1);
              })
          ),
        ];
        const start = Number(url.searchParams.get('continuation-token') ?? 0);
        const page = entries.slice(start, start + 1000);
        const truncated = start + page.length < entries.length;
        const xml = page
          .map((key) =>
            delimiter && key.endsWith('/')
              ? `<CommonPrefixes><Prefix>${key}</Prefix></CommonPrefixes>`
              : `<Contents><Key>${key}</Key></Contents>`
          )
          .join('');
        active -= 1;
        return new Response(
          `<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><IsTruncated>${truncated}</IsTruncated>${truncated ? `<NextContinuationToken>${start + page.length}</NextContinuationToken>` : ''}${xml}</ListBucketResult>`
        );
      },
    },
  });
  return { store, peak: () => peak, requests: () => requests };
}

// regression: verify-report-cleanup-serial-commit-listing
// regression: s3-listing-concurrency-browser-signing
test('lists a 56,999-object commit through its child directories concurrently', async () => {
  const sha = '075ee6c683761e1b2173d33aa0d0ccfebdb404ea';
  const keys = Array.from(
    { length: 56_999 },
    (_, n) => `commits/${sha}/tests/source-${n % 63}/file-${n}.html`
  );
  const fixture = listingStore(keys, true);
  expect(await fixture.store.listKeys('commits/0')).toEqual(keys.sort());
  expect(fixture.peak()).toBeGreaterThan(1);
  expect(fixture.peak()).toBeLessThanOrEqual(16);
});

// regression: verify-report-cleanup-serial-commit-listing
test('reads a small snapshot subtree in one page regardless of its folder depth', async () => {
  const keys = Array.from(
    { length: 128 },
    (_, n) => `tests/source/scenario/step-${n}/actors/actor/frame.html`
  );
  const fixture = listingStore(keys);
  expect(await fixture.store.listKeys('tests/')).toEqual(keys.sort());
  expect(fixture.requests()).toBe(1);
});

test('directory traversal preserves every matching key and paginates flat directories', async () => {
  await assertProperty(
    'S3 listing preserves keys',
    fc.asyncProperty(
      fc.uniqueArray(
        fc.tuple(fc.integer({ min: 0, max: 4 }), fc.nat({ max: 20 })),
        { maxLength: 25 }
      ),
      async (entries) => {
        const keys = [
          ...new Set(entries.map(([dir, file]) => `tree/${dir}/file-${file}`)),
        ];
        const fixture = listingStore([...keys, 'other/keep']);
        expect(await fixture.store.listKeys('tree/')).toEqual(keys.sort());
      }
    )
  );
  const keys = Array.from({ length: 1001 }, (_, n) => `flat/file-${n}`);
  expect(await listingStore(keys).store.listKeys('flat/')).toEqual(keys.sort());
});

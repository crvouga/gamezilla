import { expect, test } from 'bun:test';
import { catalogSource } from '@apps/product/developer-catalog-source';
import { reportMeta } from '@apps/product/developer-report';
import { publishSource } from '@pkgs/harness-report-shared/publish';
import { testFrameKey } from '@pkgs/harness-shared/keys';
import { readUtf8 } from '@pkgs/object-store-shared/helpers';
import { ObjectStoreImplInMemory } from '@pkgs/object-store-shared/impl-in-memory';

// regression: report-catalog-fixture-missing-snapshots
test('catalog source includes snapshots for every published test', async () => {
  const local = await catalogSource([
    { ...reportMeta('Alice accepts a friend request'), testId: 'completed' },
    { ...reportMeta('Bob opens a space'), testId: 'passing' },
    { ...reportMeta('Later edition only'), testId: 'later' },
  ]);
  for (const id of ['completed', 'passing', 'later']) {
    expect(
      await readUtf8(local, testFrameKey('latest', id, 'frames/alice-2.html'))
    ).toContain('alice at moment 2');
  }
  const source = await publishSource(new ObjectStoreImplInMemory(), {
    sha: '1111111111111111111111111111111111111111',
    packageDir: 'investigation',
    bucket: 'completed',
    local,
  });
  expect(source?.tests).toHaveLength(3);
});

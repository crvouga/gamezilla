import { expect, test } from 'bun:test';
import { selectMigrateDatabaseUrl } from '@libs/runtime/root/server/migrate';

// regression: deploy-migrate-stale-database-url
test('migration prefers the live post-foundation database URL', () => {
  const staleInjected = new URL(
    'postgresql://ep-fancy-dream.us-east-1.aws.neon.tech/neondb'
  );
  staleInjected.username = 'owner';
  staleInjected.password = 'old';
  const liveFoundation = new URL(
    'postgresql://aws.connect.psdb.cloud/postgres'
  );
  liveFoundation.username = 'role';
  liveFoundation.password = 'new';

  expect(
    selectMigrateDatabaseUrl({
      injected: staleInjected.toString(),
      live: liveFoundation.toString(),
    })
  ).toBe(liveFoundation.toString());
});

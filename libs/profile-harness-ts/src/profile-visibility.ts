import type { ProductHarness } from '@libs/harness-ts/harness';
import { ProfileReadRepository } from '@libs/profile-shared-ts/read-profile';

export function profileVisibleToPeople(s: ProductHarness, accountId: string) {
  return new ProfileReadRepository(s.harness.serverSql.sqlClient).readCardById(
    accountId
  );
}

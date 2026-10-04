import type { ProductHarness } from '@libs/harness/harness';
import { ProfileReadRepository } from '@libs/profile-shared/read-profile';

export function profileVisibleToPeople(s: ProductHarness, accountId: string) {
  return new ProfileReadRepository(s.harness.serverSql.sqlClient).readCardById(
    accountId
  );
}

import type { ProductHarness } from '@libs/harness/system/harness';
import { ProfileReadRepository } from '../public/read-profile';

export function profileVisibleToPeople(s: ProductHarness, accountId: string) {
  return new ProfileReadRepository(s.harness.serverSql.sqlClient).readCardById(
    accountId
  );
}

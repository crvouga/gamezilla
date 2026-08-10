import type { SqlTx } from '@pkgs/sql-client/interface';

import { MemberOfSpaceIdsLoader } from './load-member-of-space-ids-sql';

export class MemberOfSpaceIdsService {
  constructor(private readonly tx: SqlTx) {}

  async load(myId: string): Promise<string[]> {
    return new MemberOfSpaceIdsLoader(this.tx).load(myId);
  }
}

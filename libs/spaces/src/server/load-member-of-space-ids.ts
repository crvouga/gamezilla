import type { SqlClient } from '@pkgs/sql-client/interface';

import { MemberOfSpaceIdsLoader } from './load-member-of-space-ids-sql';

export class MemberOfSpaceIdsService {
  private readonly loader: MemberOfSpaceIdsLoader;

  constructor(sql: SqlClient) {
    this.loader = new MemberOfSpaceIdsLoader(sql);
  }

  async load(myId: string): Promise<string[]> {
    return this.loader.load(myId);
  }
}

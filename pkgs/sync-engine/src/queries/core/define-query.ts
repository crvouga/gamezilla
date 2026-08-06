import { assert } from '@pkgs/assert';

import type { QueryDef } from './types';

export function defineQuery<P>(q: QueryDef<P>): QueryDef<P> {
  assert.ok(
    Number.isFinite(q.limit) && q.limit > 0,
    `Query ${q.name}: hard limit required`
  );
  assert.ok(q.hydrates.length > 0, `Query ${q.name}: hydrates required`);
  return q;
}
